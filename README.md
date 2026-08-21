# @flashphoner/sfusdk

# Flashphoner WebCallServer SFU API (SFU SDK)

Flashphoner [WebCallServer](https://flashphoner.com) [SFU](https://docs.flashphoner.com/display/WCS52EN/SFU+functions+with+Simulcast) API (SFU SDK) implementation.

## Install
```
npm install @flashphoner/sfusdk
```

## Usage example
```
import React, {useState} from "react";
import {Sfu, SfuEvent} from "@flashphoner/sfusdk";

export default function TestApp() {
    const [url, setUrl] = useState("ws://localhost:8080");
    const [established, setEstablished] = useState("Not connected");
    const [buttonText, setButtonText] = useState("Connect");
    const [session, setSession] = useState(null);

    function createRoom(options: {
        url: string,
        roomName: string,
        pin: string,
        nickname: string,
        pc: RTCPeerConnection
    }) {
        const sfu = new Sfu();
        sfu.connect({
            url: options.url,
            nickname: options.nickname,
            logGroup: options.roomName
        });
        const room = sfu.createRoom({
            name: options.roomName,
            pin: options.pin,
            pc: options.pc
        });
        return sfu;
    }

    function onClick() {
        if (session == null) {
            console.log("Trying to connect");
            const pc = new RTCPeerConnection();
            const s = createRoom({
                url: url,
                roomName: "ROOM",
                pin: "1234",
                nickname: "Test",
                pc: pc
            }).on(SfuEvent.CONNECTED, (room) => {
                console.log("Connected!");
                setEstablished("Connected!");
                setButtonText("Disconnect");
                setSession(s);
                room.join();
            }).on(SfuEvent.DISCONNECTED, () => {
                console.log("Disconnected!");
                setEstablished("Not connected!");
                setButtonText("Connect");
                setSession(null);
            });
        } else {
            let room = session.room();
            if(room) {
                room.destroyRoom()
            }
            session.disconnect();            
        }
    }

    return(
        <div>
            <div>
                <input type="text" value={url} placeholder="Enter server websocket URL" onChange={(e) => setUrl(e.target.value)}/>
                <button onClick={() => onClick()}>{buttonText}</button>
            </div>
            <div>{established}</div>
        </div>
        
    )
}
```

## Catch up message synchronization

Live notifications (`SfuEvent.MESSAGE` and friends) deliver changes while the client is online. The message
journal covers the rest: every change of a message (a new message, an edit, a deletion, a reaction) gets a
monotonic per entity number, `seq`, and the client keeps the last one it has seen as a cursor. On start and on
every reconnect the client asks for the current cursors of all its entities, and pulls the difference of those
that diverged.

Two operations back this up:

* `getChatsSyncSummary()` returns the current server cursor of every chat, channel and thread of the user in
  a single request.
* `getMessagesDifference(config)` returns the actual state of every message of an entity changed after
  `config.sinceCursor`, deduplicated by id and ordered by `seq`, together with the `newCursor` to store,
  `hasMore` when the response was truncated by `limit`, and `resyncRequired` when the client fell behind the
  journal retention.

`MessagesSynchronizer` drives them. Persisting messages and cursors stays with the client, the synchronizer
reaches it through a `MessagesSyncStore`:

```typescript
import {MessagesSynchronizer, SfuExtended} from "@flashphoner/sfusdk";

const sfu = new SfuExtended();
const sync = new MessagesSynchronizer(sfu, {
    store: {
        getCursors: () => cache.readCursors(),
        //replace the local copy of every message by its id, the order of the responses does not matter
        applyMessages: ({targetEntityType, targetEntityId, messages, resync}) =>
            cache.upsertMessages(targetEntityType, targetEntityId, messages, resync),
        saveCursor: ({targetEntityType, targetEntityId, cursor}) =>
            cache.writeCursor(targetEntityType, targetEntityId, cursor)
    }
}).attach(sfu);

//the chat the user is looking at is pulled first
sync.setActiveEntity({targetEntityType: MessageTargetEntityType.CHAT, targetEntityId: {chatId}});

await sfu.connect({url, username, password});
//attach() runs the synchronization on this connect and on every reconnect
```

Rules the client has to keep, otherwise the caches drift apart:

* Apply a message by replacing the local copy with the same id. What to draw follows from the fields of the
  message itself (`status === DELETED`, `edited`, `reactions`), not from the order the responses arrived in.
* A cursor only moves forward, and only to a `newCursor` of a difference response or to the `seq` of a live
  event that follows the local cursor immediately. Everything else is re-read on the next difference, applying
  it twice changes nothing.
* A gap in the numbers is a reason to check with a difference, not a conclusion that something was lost:
  numbers are handed out atomically but may be delivered out of order, and private messages of other users
  leave holes on purpose.
* `resyncRequired` means the journal no longer covers the gap. The synchronizer reloads the entity in full
  through `loadMessages` and takes the cursor from the summary.

### Cursors of the live stream

Every live event the server journals carries the `seq` of its journal record, so the cursor of an entity does
not have to wait for the next start or reconnect to move. `SfuExtended` emits that number as a separate
`SfuEvent.MESSAGE_CURSOR` with a `MessageCursorEvent` payload, for `SFU_MESSAGE`, `SEND_MESSAGE_SYNC`,
`CHAT_MESSAGE_EDITED`, `CHAT_MESSAGE_DELETED` and both reaction events. Status events
(`SFU_MESSAGE_STATE`, `UPDATE_MESSAGES_DELIVERY_STATUS`, `LAST_READ_MESSAGE_UPDATED`) are not journaled and
carry no cursor.

The payloads of the live events themselves are untouched: subscribers of `SfuEvent.MESSAGE` keep receiving a
`Message`. The cursor is emitted before the event is either handed to the promise of an own request or
notified to the subscribers, so a change made by this very client moves the cursor just like anybody else's —
as far as the server stamps one. The answer to an own `sendMessage` arrives as a message state, and the
answers to an own `editMessage` and `deleteMessage` carry no cursor yet, so the cursor of a client doing the
writing lags behind until the next change of somebody else, which is closed by a single difference request.

`attach()` wires it up, there is nothing else to do:

```typescript
const sync = new MessagesSynchronizer(sfu, {
    store,
    //defaults, all optional
    liveCursor: true,           //advance cursors from live events
    gapCheckDelayMs: 300,       //debounce before a gap is checked with a difference request
    gapCheckMinIntervalMs: 5000 //minimum interval between gap triggered differences of the same entity
}).attach(sfu);
```

A client that dispatches live events on its own calls `sync.applyLiveCursor(event)` instead. Applying the
change to the cache is a separate matter in both cases: that is done by the regular handler of
`SfuEvent.MESSAGE` and friends, whatever happens to the cursor.

What the synchronizer does with a live `seq`:

| Relation to the local cursor | What happens |
|---|---|
| the entity is not tracked yet | ignored, a cursor is never created from a live event |
| a difference of this entity is in flight | ignored, the `newCursor` of the response wins |
| `cursor <= local` | ignored, cursors never move backwards |
| `cursor === local + 1` | stored through `saveCursor`, exactly like a `newCursor` |
| `cursor > local + 1` | a gap: the cursor stays, the entity is checked with a difference request |
| `cursor === 0` | ignored, the change was not journaled |

The first line is the one worth remembering: `getCursor()` returns `0` both for an entity standing at the
beginning of the journal and for an entity that was never synchronized, and the two are not the same thing.
Accepting `seq = 1` for an entity the client has no cursor for would claim that its whole history up to that
change is already cached, and the hole would stay for good. Use `hasCursor(entity)` to tell them apart. Such an
entity is picked up the regular way: by the summary of the next run, or by a full `loadMessages` when the user
opens it.

A gap check is debounced and throttled per entity, and reported as `MessagesSyncEvent.GAP_DETECTED` for
observability. Gaps are routine rather than alarming: private messages of other users consume numbers this
client never receives, so an entity with a lively private correspondence in it runs into a gap on almost every
message. The difference such a check requests is cheap and moves the cursor past the hole.

## Documentation

[SFU functions description](https://docs.flashphoner.com/display/WCS52EN/SFU+functions+with+Simulcast)

[SFU SDK documentation](https://docs.flashphoner.com/display/SS1E/SFU+SDK+1.0+-+EN)

[SFU examples description](https://docs.flashphoner.com/display/SS1E/SFU+SDK+Examples)

[API documentation](http://flashphoner.com/docs/api/WCS5/client/sfu-sdk/latest)

## Known issues

SFU SDK is built with [webrtc/adapter](https://github.com/webrtc/adapter/) library version not lower than 7.2.6. In this regard, direct use of this library together with WebSDK should be avoided.
