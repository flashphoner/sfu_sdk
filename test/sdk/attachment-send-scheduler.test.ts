import {AttachmentSendScheduler} from "../../src/sdk/attachments/attachment-send-scheduler";

const flush = async () => {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
};

const settled = async (promise: Promise<unknown>): Promise<boolean> => {
    let done = false;
    promise.then(() => { done = true; }, () => { done = true; });
    await flush();
    return done;
};

describe.skip("attachment send scheduler", () => {

    test("byte gate: the successor uploads only after the head's bytes are done", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const head = scheduler.enqueue("chat");
        const tail = scheduler.enqueue("chat");
        const headTurn = head.awaitByteTurn();
        const tailTurn = tail.awaitByteTurn();
        expect(await settled(headTurn)).toBe(true);
        expect(await settled(tailTurn)).toBe(false);
        head.markBytesDone();
        expect(await settled(tailTurn)).toBe(true);
    });

    test("delivery gate: FIFO even when the successor's bytes are done first", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const head = scheduler.enqueue("chat");
        const tail = scheduler.enqueue("chat");
        head.markBytesDone();
        tail.markBytesDone();
        const tailTurn = tail.awaitDeliveryTurn();
        expect(await settled(tailTurn)).toBe(false);
        head.settle();
        expect(await settled(tailTurn)).toBe(true);
    });

    test("a failed head releases both gates of the successor", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const head = scheduler.enqueue("chat");
        const tail = scheduler.enqueue("chat");
        const bytes = tail.awaitByteTurn();
        const delivery = tail.awaitDeliveryTurn();
        head.settle();
        expect(await settled(bytes)).toBe(true);
        expect(await settled(delivery)).toBe(true);
    });

    test("the reviewed case: of 1,2,3,4 the members 2 and 3 go out of queue", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const m1 = scheduler.enqueue("chat");
        const m2 = scheduler.enqueue("chat");
        const m3 = scheduler.enqueue("chat");
        const m4 = scheduler.enqueue("chat");
        m2.detach();
        m3.detach();
        expect(await settled(m2.awaitByteTurn())).toBe(true);
        expect(await settled(m3.awaitDeliveryTurn())).toBe(true);
        const bytes4 = m4.awaitByteTurn();
        const delivery4 = m4.awaitDeliveryTurn();
        expect(await settled(bytes4)).toBe(false);
        m1.markBytesDone();
        expect(await settled(bytes4)).toBe(true);
        expect(await settled(delivery4)).toBe(false);
        m2.settle();
        m3.settle();
        expect(await settled(delivery4)).toBe(false);
        m1.settle();
        expect(await settled(delivery4)).toBe(true);
    });

    test("queues of different entities do not wait for each other", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        scheduler.enqueue("chat-a");
        const other = scheduler.enqueue("chat-b");
        expect(await settled(other.awaitByteTurn())).toBe(true);
        expect(await settled(other.awaitDeliveryTurn())).toBe(true);
    });

    test("slot pool caps the parallelism and grants freed slots", async () => {
        const scheduler = new AttachmentSendScheduler(2);
        const member = scheduler.enqueue("chat");
        const first = member.acquireSlot();
        const second = member.acquireSlot();
        const third = member.acquireSlot();
        expect(await settled(first)).toBe(true);
        expect(await settled(second)).toBe(true);
        expect(await settled(third)).toBe(false);
        (await first)();
        expect(await settled(third)).toBe(true);
    });

    test("a freed slot goes to the member holding the fewest, not to the first comer", async () => {
        const scheduler = new AttachmentSendScheduler(2);
        const hog = scheduler.enqueue("chat-a");
        const releaseHog1 = await hog.acquireSlot();
        await hog.acquireSlot();
        const hogMore = hog.acquireSlot();
        const late = scheduler.enqueue("chat-b");
        const lateSlot = late.acquireSlot();
        releaseHog1();
        expect(await settled(lateSlot)).toBe(true);
        expect(await settled(hogMore)).toBe(false);
    });

    test("a queued member gets no slot before its byte turn", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const head = scheduler.enqueue("chat");
        const tail = scheduler.enqueue("chat");
        const tailSlot = tail.acquireSlot();
        expect(await settled(tailSlot)).toBe(false);
        head.markBytesDone();
        expect(await settled(tailSlot)).toBe(true);
        expect(await settled(head.acquireSlot())).toBe(true);
    });

    test("escape breaks a gate wait: the cancel path never hangs in the queue", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        scheduler.enqueue("chat");
        const tail = scheduler.enqueue("chat");
        let cancelled = false;
        const turn = tail.awaitByteTurn(() => cancelled);
        expect(await settled(turn)).toBe(false);
        cancelled = true;
        tail.poke();
        expect(await settled(turn)).toBe(true);
    });

    test("settle resolves the member's pending slot waits with a free pass", async () => {
        const scheduler = new AttachmentSendScheduler(1);
        const hog = scheduler.enqueue("chat-a");
        await hog.acquireSlot();
        const cancelled = scheduler.enqueue("chat-b");
        const wait = cancelled.acquireSlot();
        expect(await settled(wait)).toBe(false);
        cancelled.settle();
        expect(await settled(wait)).toBe(true);
    });

    test("the free pass of a settled member does not consume the pool", async () => {
        const scheduler = new AttachmentSendScheduler(1);
        const hog = scheduler.enqueue("chat-a");
        const releaseHog = await hog.acquireSlot();
        const failed = scheduler.enqueue("chat-b");
        const freePass = failed.acquireSlot();
        failed.settle();
        (await freePass)();
        const third = scheduler.enqueue("chat-c");
        const thirdSlot = third.acquireSlot();
        expect(await settled(thirdSlot)).toBe(false);
        releaseHog();
        expect(await settled(thirdSlot)).toBe(true);
    });

    test("acquireSlot of an already settled member resolves at once", async () => {
        const scheduler = new AttachmentSendScheduler(1);
        const hog = scheduler.enqueue("chat-a");
        await hog.acquireSlot();
        const cancelled = scheduler.enqueue("chat-b");
        cancelled.settle();
        expect(await settled(cancelled.acquireSlot())).toBe(true);
    });

    test("a retry re-enters at the tail and waits for the members already queued", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const failed = scheduler.enqueue("chat");
        const second = scheduler.enqueue("chat");
        failed.settle();
        const retry = scheduler.enqueue("chat");
        const retryBytes = retry.awaitByteTurn();
        expect(await settled(retryBytes)).toBe(false);
        second.markBytesDone();
        expect(await settled(retryBytes)).toBe(true);
    });

    test("a late chat wins the first freed slot instead of queueing behind the hog", async () => {
        const scheduler = new AttachmentSendScheduler(3);
        const first = scheduler.enqueue("chat-a");
        const releaseFirst = await first.acquireSlot();
        await first.acquireSlot();
        await first.acquireSlot();
        const fourth = first.acquireSlot();
        const second = scheduler.enqueue("chat-b");
        const late = second.acquireSlot();
        expect(first.heldSlots).toBe(3);
        releaseFirst();
        expect(await settled(late)).toBe(true);
        expect(await settled(fourth)).toBe(false);
        expect(first.heldSlots).toBe(2);
        expect(second.heldSlots).toBe(1);
    });

    test("a detached member shares the pool instead of pausing the head", async () => {
        const scheduler = new AttachmentSendScheduler(2);
        const head = scheduler.enqueue("chat");
        const skipper = scheduler.enqueue("chat");
        skipper.detach();
        const headSlot = head.acquireSlot();
        const skipperSlot = skipper.acquireSlot();
        expect(await settled(headSlot)).toBe(true);
        expect(await settled(skipperSlot)).toBe(true);
    });
});
