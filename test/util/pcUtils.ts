export const waitForPeerConnectionStableState = (pc:any) => {
    return waitForPeerConnectionState(pc, "stable");
}
export const waitForPeerConnectionClosedState = (pc:any) => {
    return waitForPeerConnectionState(pc, "closed");
}

export const waitForPeerConnectionState = (pc:any, state:string) => {
    return new Promise((resolve: Function, reject) => {
        if (pc.signalingState === state) {
            resolve();
        }
        pc.onsignalingstatechange = (e: any) => {
            if (pc.signalingState === state) {
                resolve();
            }
        }
    });
};