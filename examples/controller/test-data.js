'use strict'

const testStats = {
    "participants": [
        {
            "nickName": "Alice",
            "outgoingTracks": [
                {
                    "id": "60bbba84-6b95-4d7f-a8b9-5d38bf972605",
                    "composite": true,
                    "tracks": {
                        "h send": {
                            "id": "60bbba84-6b95-4d7f-a8b9-5d38bf972605",
                            "codec": "VP8",
                            "width": 960,
                            "height": 540,
                            "fps": 12,
                            "bitrate": 544816,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "m send": {
                            "id": "60bbba84-6b95-4d7f-a8b9-5d38bf972605",
                            "codec": "VP8",
                            "width": 480,
                            "height": 270,
                            "fps": 13,
                            "bitrate": 275872,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "l send": {
                            "id": "60bbba84-6b95-4d7f-a8b9-5d38bf972605",
                            "codec": "VP8",
                            "width": 240,
                            "height": 135,
                            "fps": 13,
                            "bitrate": 89896,
                            "alive": true,
                            "type": "VIDEO"
                        }
                    }
                },
                {
                    "id": "b770d6fd-75e5-42df-8be0-2a025a75d56d",
                    "codec": "opus",
                    "bitrate": 0,
                    "sampleRate": 48000,
                    "channels": 2,
                    "alive": true,
                    "type": "AUDIO"
                }
            ],
            "incomingTracks": {
                "88b683fc-b972-436f-9a25-b1cba4af61b1": "m send",
                "a112614e-3af1-430e-b364-5b6d75ce3059": null,
                "4d1ece4d-5b75-4816-afd4-dd66a733c091": null,
                "f5dc9935-3944-407f-83ec-10ab74559c07": "m send",
                "319b4b8a-e963-474c-b93e-9d7f06af996e": null,
                "84d158e7-5870-4f62-8f82-a0a77a351a8e": null,
                "1bd17c9a-7b6f-4733-9d07-9d54375854cb": "l send",
                "47997f18-ab1e-414a-b792-095d6d52a407": null,
                "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2": "l send",
                "924a313f-c8b2-4340-8976-c695d00ab0db": "h send"
            }
        },
        {
            "nickName": "Bob",
            "outgoingTracks": [
                {
                    "id": "924a313f-c8b2-4340-8976-c695d00ab0db",
                    "composite": true,
                    "tracks": {
                        "h send": {
                            "id": "924a313f-c8b2-4340-8976-c695d00ab0db",
                            "codec": "VP8",
                            "width": 1280,
                            "height": 720,
                            "fps": 9,
                            "bitrate": 502344,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "m send": {
                            "id": "924a313f-c8b2-4340-8976-c695d00ab0db",
                            "codec": "VP8",
                            "width": 640,
                            "height": 360,
                            "fps": 10,
                            "bitrate": 246360,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "l send": {
                            "id": "924a313f-c8b2-4340-8976-c695d00ab0db",
                            "codec": "VP8",
                            "width": 320,
                            "height": 180,
                            "fps": 10,
                            "bitrate": 83008,
                            "alive": true,
                            "type": "VIDEO"
                        }
                    }
                },
                {
                    "id": "a112614e-3af1-430e-b364-5b6d75ce3059",
                    "codec": "opus",
                    "bitrate": 0,
                    "sampleRate": 48000,
                    "channels": 2,
                    "alive": true,
                    "type": "AUDIO"
                }
            ],
            "incomingTracks": {
                "88b683fc-b972-436f-9a25-b1cba4af61b1": "m send",
                "4d1ece4d-5b75-4816-afd4-dd66a733c091": null,
                "f5dc9935-3944-407f-83ec-10ab74559c07": "m send",
                "319b4b8a-e963-474c-b93e-9d7f06af996e": null,
                "84d158e7-5870-4f62-8f82-a0a77a351a8e": null,
                "b770d6fd-75e5-42df-8be0-2a025a75d56d": null,
                "60bbba84-6b95-4d7f-a8b9-5d38bf972605": "l send",
                "1bd17c9a-7b6f-4733-9d07-9d54375854cb": "l send",
                "47997f18-ab1e-414a-b792-095d6d52a407": null,
                "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2": "l send"
            }
        },
        {
            "nickName": "Alex",
            "outgoingTracks": [
                {
                    "id": "319b4b8a-e963-474c-b93e-9d7f06af996e",
                    "codec": "opus",
                    "bitrate": 0,
                    "sampleRate": 48000,
                    "channels": 2,
                    "alive": true,
                    "type": "AUDIO"
                },
                {
                    "id": "f5dc9935-3944-407f-83ec-10ab74559c07",
                    "composite": true,
                    "tracks": {
                        "h send": {
                            "id": "f5dc9935-3944-407f-83ec-10ab74559c07",
                            "codec": "VP8",
                            "width": 960,
                            "height": 540,
                            "fps": 12,
                            "bitrate": 566264,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "m send": {
                            "id": "f5dc9935-3944-407f-83ec-10ab74559c07",
                            "codec": "VP8",
                            "width": 480,
                            "height": 270,
                            "fps": 13,
                            "bitrate": 283312,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "l send": {
                            "id": "f5dc9935-3944-407f-83ec-10ab74559c07",
                            "codec": "VP8",
                            "width": 240,
                            "height": 135,
                            "fps": 12,
                            "bitrate": 79000,
                            "alive": true,
                            "type": "VIDEO"
                        }
                    }
                }
            ],
            "incomingTracks": {
                "88b683fc-b972-436f-9a25-b1cba4af61b1": "h send",
                "4d1ece4d-5b75-4816-afd4-dd66a733c091": null,
                "a112614e-3af1-430e-b364-5b6d75ce3059": null,
                "84d158e7-5870-4f62-8f82-a0a77a351a8e": null,
                "b770d6fd-75e5-42df-8be0-2a025a75d56d": null,
                "60bbba84-6b95-4d7f-a8b9-5d38bf972605": "h send",
                "1bd17c9a-7b6f-4733-9d07-9d54375854cb": "l send",
                "47997f18-ab1e-414a-b792-095d6d52a407": null,
                "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2": "h send",
                "924a313f-c8b2-4340-8976-c695d00ab0db": "h send"
            }
        },
        {
            "nickName": "Kiri",
            "outgoingTracks": [
                {
                    "id": "1bd17c9a-7b6f-4733-9d07-9d54375854cb",
                    "composite": true,
                    "tracks": {
                        "h send": {
                            "id": "1bd17c9a-7b6f-4733-9d07-9d54375854cb",
                            "codec": "VP8",
                            "width": 0,
                            "height": 0,
                            "fps": 0,
                            "bitrate": 0,
                            "alive": false,
                            "type": "VIDEO"
                        },
                        "m send": {
                            "id": "1bd17c9a-7b6f-4733-9d07-9d54375854cb",
                            "codec": "VP8",
                            "width": 640,
                            "height": 360,
                            "fps": 15,
                            "bitrate": 287936,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "l send": {
                            "id": "1bd17c9a-7b6f-4733-9d07-9d54375854cb",
                            "codec": "VP8",
                            "width": 320,
                            "height": 180,
                            "fps": 15,
                            "bitrate": 107712,
                            "alive": true,
                            "type": "VIDEO"
                        }
                    }
                },
                {
                    "id": "84d158e7-5870-4f62-8f82-a0a77a351a8e",
                    "codec": "opus",
                    "bitrate": 0,
                    "sampleRate": 48000,
                    "channels": 2,
                    "alive": true,
                    "type": "AUDIO"
                }
            ],
            "incomingTracks": {
                "88b683fc-b972-436f-9a25-b1cba4af61b1": "h send",
                "4d1ece4d-5b75-4816-afd4-dd66a733c091": null,
                "a112614e-3af1-430e-b364-5b6d75ce3059": null,
                "f5dc9935-3944-407f-83ec-10ab74559c07": "h send",
                "319b4b8a-e963-474c-b93e-9d7f06af996e": null,
                "b770d6fd-75e5-42df-8be0-2a025a75d56d": null,
                "60bbba84-6b95-4d7f-a8b9-5d38bf972605": "h send",
                "47997f18-ab1e-414a-b792-095d6d52a407": null,
                "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2": "h send",
                "924a313f-c8b2-4340-8976-c695d00ab0db": "h send"
            }
        },
        {
            "nickName": "Margaret",
            "outgoingTracks": [
                {
                    "id": "47997f18-ab1e-414a-b792-095d6d52a407",
                    "codec": "opus",
                    "bitrate": 0,
                    "sampleRate": 48000,
                    "channels": 2,
                    "alive": true,
                    "type": "AUDIO"
                },
                {
                    "id": "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2",
                    "composite": true,
                    "tracks": {
                        "h send": {
                            "id": "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2",
                            "codec": "VP8",
                            "width": 1280,
                            "height": 720,
                            "fps": 11,
                            "bitrate": 511408,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "m send": {
                            "id": "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2",
                            "codec": "VP8",
                            "width": 640,
                            "height": 360,
                            "fps": 11,
                            "bitrate": 243616,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "l send": {
                            "id": "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2",
                            "codec": "VP8",
                            "width": 320,
                            "height": 180,
                            "fps": 11,
                            "bitrate": 79840,
                            "alive": true,
                            "type": "VIDEO"
                        }
                    }
                }
            ],
            "incomingTracks": {
                "88b683fc-b972-436f-9a25-b1cba4af61b1": "h send",
                "4d1ece4d-5b75-4816-afd4-dd66a733c091": null,
                "a112614e-3af1-430e-b364-5b6d75ce3059": null,
                "f5dc9935-3944-407f-83ec-10ab74559c07": "m send",
                "319b4b8a-e963-474c-b93e-9d7f06af996e": null,
                "84d158e7-5870-4f62-8f82-a0a77a351a8e": null,
                "b770d6fd-75e5-42df-8be0-2a025a75d56d": null,
                "60bbba84-6b95-4d7f-a8b9-5d38bf972605": "h send",
                "1bd17c9a-7b6f-4733-9d07-9d54375854cb": "l send",
                "924a313f-c8b2-4340-8976-c695d00ab0db": "h send"
            }
        },
        {
            "nickName": "John",
            "outgoingTracks": [
                {
                    "id": "88b683fc-b972-436f-9a25-b1cba4af61b1",
                    "composite": true,
                    "tracks": {
                        "h send": {
                            "id": "88b683fc-b972-436f-9a25-b1cba4af61b1",
                            "codec": "VP8",
                            "width": 960,
                            "height": 540,
                            "fps": 10,
                            "bitrate": 489040,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "m send": {
                            "id": "88b683fc-b972-436f-9a25-b1cba4af61b1",
                            "codec": "VP8",
                            "width": 480,
                            "height": 270,
                            "fps": 12,
                            "bitrate": 277760,
                            "alive": true,
                            "type": "VIDEO"
                        },
                        "l send": {
                            "id": "88b683fc-b972-436f-9a25-b1cba4af61b1",
                            "codec": "VP8",
                            "width": 240,
                            "height": 135,
                            "fps": 12,
                            "bitrate": 90880,
                            "alive": true,
                            "type": "VIDEO"
                        }
                    }
                },
                {
                    "id": "4d1ece4d-5b75-4816-afd4-dd66a733c091",
                    "codec": "opus",
                    "bitrate": 0,
                    "sampleRate": 48000,
                    "channels": 2,
                    "alive": true,
                    "type": "AUDIO"
                }
            ],
            "incomingTracks": {
                "a112614e-3af1-430e-b364-5b6d75ce3059": null,
                "f5dc9935-3944-407f-83ec-10ab74559c07": "m send",
                "319b4b8a-e963-474c-b93e-9d7f06af996e": null,
                "84d158e7-5870-4f62-8f82-a0a77a351a8e": null,
                "b770d6fd-75e5-42df-8be0-2a025a75d56d": null,
                "60bbba84-6b95-4d7f-a8b9-5d38bf972605": "h send",
                "1bd17c9a-7b6f-4733-9d07-9d54375854cb": "l send",
                "47997f18-ab1e-414a-b792-095d6d52a407": null,
                "923bdbcc-8b3e-42f1-9d25-561c3c3b0bf2": "l send",
                "924a313f-c8b2-4340-8976-c695d00ab0db": "h send"
            }
        }
    ]
}

module.exports = {
    testStats: testStats
}