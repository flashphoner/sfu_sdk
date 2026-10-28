type SlotWaiter = {
    member: AttachmentSendQueueMember;
    resolve: (release: () => void) => void;
};

export class AttachmentSendScheduler {

    readonly #parallelism: number;
    #queues: Map<string, AttachmentSendQueueMember[]> = new Map();
    #slotWaiters: SlotWaiter[] = [];
    #gateWaiters: Array<() => void> = [];
    #slotsUsed = 0;
    #seq = 0;

    constructor(parallelism: number) {
        this.#parallelism = parallelism;
    }

    enqueue(queueKey: string | null): AttachmentSendQueueMember {
        const member = new AttachmentSendQueueMember(this, queueKey, this.#seq++);
        if (queueKey === null) {
            member.state = "detached";
        } else {
            let queue = this.#queues.get(queueKey);
            if (!queue) {
                queue = [];
                this.#queues.set(queueKey, queue);
            }
            queue.push(member);
        }
        this.bump();
        return member;
    }

    predecessors(member: AttachmentSendQueueMember): AttachmentSendQueueMember[] {
        if (member.state !== "queued" || member.queueKey === null) {
            return [];
        }
        const queue = this.#queues.get(member.queueKey);
        if (!queue) {
            return [];
        }
        const at = queue.indexOf(member);
        return at <= 0 ? [] : queue.slice(0, at);
    }

    removeFromOrder(member: AttachmentSendQueueMember) {
        if (member.queueKey === null) {
            return;
        }
        const queue = this.#queues.get(member.queueKey);
        if (!queue) {
            return;
        }
        const at = queue.indexOf(member);
        if (at >= 0) {
            queue.splice(at, 1);
        }
        if (!queue.length) {
            this.#queues.delete(member.queueKey);
        }
    }

    acquireSlot(member: AttachmentSendQueueMember): Promise<() => void> {
        if (member.state === "settled") {
            /* the post-cancel walk must not hang on a pool saturated by somebody's long upload */
            return Promise.resolve(() => undefined);
        }
        return new Promise<() => void>((resolve) => {
            this.#slotWaiters.push({member, resolve});
            this.#grantSlots();
        });
    }

    releaseSlotWaiters(member: AttachmentSendQueueMember) {
        const released = this.#slotWaiters.filter((waiter) => waiter.member === member);
        this.#slotWaiters = this.#slotWaiters.filter((waiter) => waiter.member !== member);
        released.forEach((waiter) => waiter.resolve(() => undefined));
    }

    nextChange(): Promise<void> {
        return new Promise<void>((resolve) => this.#gateWaiters.push(resolve));
    }

    bump() {
        this.#grantSlots();
        const waiters = this.#gateWaiters.splice(0);
        waiters.forEach((resolve) => resolve());
    }

    #eligibleForSlot(member: AttachmentSendQueueMember): boolean {
        if (member.state === "detached") {
            return true;
        }
        if (member.state !== "queued") {
            return false;
        }
        return this.predecessors(member).every((predecessor) => predecessor.bytesDone);
    }

    #grantSlots() {
        while (this.#slotsUsed < this.#parallelism) {
            const candidates = this.#slotWaiters.filter((waiter) => this.#eligibleForSlot(waiter.member));
            if (!candidates.length) {
                return;
            }
            candidates.sort((a, b) => (a.member.heldSlots - b.member.heldSlots) || (a.member.seq - b.member.seq));
            const granted = candidates[0];
            this.#slotWaiters.splice(this.#slotWaiters.indexOf(granted), 1);
            this.#slotsUsed++;
            granted.member.heldSlots++;
            let released = false;
            granted.resolve(() => {
                if (released) {
                    return;
                }
                released = true;
                this.#slotsUsed--;
                granted.member.heldSlots--;
                this.bump();
            });
        }
    }
}

export class AttachmentSendQueueMember {

    state: "queued" | "detached" | "settled" = "queued";
    bytesDone = false;
    heldSlots = 0;
    readonly seq: number;
    readonly queueKey: string | null;
    readonly #scheduler: AttachmentSendScheduler;

    constructor(scheduler: AttachmentSendScheduler, queueKey: string | null, seq: number) {
        this.#scheduler = scheduler;
        this.queueKey = queueKey;
        this.seq = seq;
    }

    async awaitByteTurn(escape?: () => boolean): Promise<void> {
        while (this.state === "queued"
            && !this.#scheduler.predecessors(this).every((predecessor) => predecessor.bytesDone)
            && !(escape && escape())) {
            await this.#scheduler.nextChange();
        }
    }

    markBytesDone() {
        if (!this.bytesDone) {
            this.bytesDone = true;
            this.#scheduler.bump();
        }
    }

    async awaitDeliveryTurn(escape?: () => boolean): Promise<void> {
        while (this.state === "queued"
            && this.#scheduler.predecessors(this).length > 0
            && !(escape && escape())) {
            await this.#scheduler.nextChange();
        }
    }

    settle() {
        if (this.state === "settled") {
            return;
        }
        this.#scheduler.removeFromOrder(this);
        this.state = "settled";
        this.#scheduler.releaseSlotWaiters(this);
        this.#scheduler.bump();
    }

    detach() {
        if (this.state !== "queued") {
            return;
        }
        this.#scheduler.removeFromOrder(this);
        this.state = "detached";
        this.#scheduler.bump();
    }

    acquireSlot(): Promise<() => void> {
        return this.#scheduler.acquireSlot(this);
    }

    poke() {
        this.#scheduler.bump();
    }
}
