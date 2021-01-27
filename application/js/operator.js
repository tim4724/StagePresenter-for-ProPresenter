"use strict"

function Operator() {
    const broadcastChannel = new BroadcastChannel('stateUpdate')
    const playlistSelect = document.getElementById('playlist')
    const slideSelect = document.getElementById('slides')

    broadcastChannel.onmessage = (ev) => {
        const state = ev.data
        console.log("Data", state)
    }

    return {
        requestState: () => {

        }
    }
}
