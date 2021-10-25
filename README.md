# @flashphoner/sfusdk

# Flashphoner WebCallServer SFU JavaScript API (SFU SDK)

Flashphoner [WebCallServer](https://flashphoner.com) [SFU](https://docs.flashphoner.com/display/WCS52EN/SFU+functions+with+Simulcast) JavaScript API (SFU SDK) implementation.

## Install
```
npm install @flashphoner/sfusdk
```

## Usage example
```
import React, {useState} from "react";
import * as SFU from '@flashphoner/sfusdk/src/sdk/sfu.js'
import * as Constants from '@flashphoner/sfusdk/src/sdk/constants.js'

export default function TestApp() {
    const [url, setUrl] = useState("ws://localhost:8080");
    const [established, setEstablished] = useState("Not connected");
    const [buttonText, setButtonText] = useState("Connect");
    const [session, setSession] = useState(null);

    function onClick() {
        if (session == null) {
            console.log("Trying to connect");
            const pc = new RTCPeerConnection();
            const s = SFU.createRoom({
                url: url,
                roomName: "ROOM",
                pin: "1234",
                nickname: "Test",
                pc: pc
            }).on(Constants.SFU_EVENT.CONNECTED, (room) => {
                console.log("Connected!");
                setEstablished("Connected!");
                setButtonText("Disconnect");
                setSession(s);
                room.join();
            }).on(Constants.SFU_EVENT.DISCONNECTED, () => {
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

## Building browserified JS bundle

### Install grunt (if this is not installed)
```
npm install grunt
```

### Build
```
grunt build
```

### Deploy to web server
```
mkdir -p /var/www/html/flashphoner-sfu-test
cp -r out/* /var/www/html/flashphoner-sfu-test
```

## Documentation

[SFU functions description](https://docs.flashphoner.com/display/WCS52EN/SFU+functions+with+Simulcast)
[SFU SDK documentation](https://docs.flashphoner.com/display/SS1E/SFU+SDK+1.0+-+EN)
[SFU client example description](https://docs.flashphoner.com/display/SS1E/SFU+client)
[API documentation](http://flashphoner.com/docs/api/WCS5/client/sfu-sdk/latest)

## Known issues

SFU SDK is built with [webrtc/adapter](https://github.com/webrtc/adapter/) library version not lower than 7.2.6. In this regard, direct use of this library together with WebSDK should be avoided.
