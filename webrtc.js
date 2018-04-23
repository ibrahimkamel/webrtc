'use strict';
function WebrtcConnection(userName, channelName, pcConfig, startCallBtn, endCallBtn, muteCallBtn, localVideoDiv, remoteVideoDiv,
        callType)
{
        this.userName = userName;
        this.channelName = channelName;
        this.pcConfig = pcConfig;
        this.isInitiatorVideo = false;
        this.isInitiatorDataChannel = false;
        this.localVideoStream = undefined;
        this.remoteVideoStream = undefined;
        this.localVideoDiv = localVideoDiv;
        this.remoteVideoDiv = remoteVideoDiv;
        this.VideoPeerConnection = undefined;
        this.DataPeerConnection = undefined;
        this.presence = undefined;
        this.channel = undefined;
        this.ably = new Ably.Realtime(
        {
            authUrl: '/auth/api/' + this.channelName
        });
        // console.log(this.ably);
        this.timer = setInterval(this.InitiateConnections, 500);
        this.callType = callType;
        this.callMute = false;
        this.startCallBtn = startCallBtn;
        this.endCallBtn = endCallBtn;
        this.startCallBtn.disabled = false;
        this.startCallBtn.style.visibility = 'visible';
        this.endCallBtn.disabled = true;
        this.endCallBtn.style.visibility = 'hidden';
        this.muteCallBtn = muteCallBtn;
        this.muteCallBtn.disabled = true;
        this.muteCallBtn.style.visibility = 'hidden';

    this.sendMessage = function(message)
    {
        message['userName'] = this.userName;
        this.channel.publish(this.channelName, JSON.stringify(message));
        console.log('Message Sent on Channel' + this.channelName);
    };
    this.createPeerConnection = function ()
    {
        try
        {
            this.VideoPeerConnection = new RTCPeerConnection(this.pcConfig);
            console.log('Video PeerConnection Created Successfully');
            this.VideoPeerConnection.onicecandidate = this.handleIceCandidate;
            this.VideoPeerConnection.onaddstream = this.handleRemoteStreamAdded;
            this.VideoPeerConnection.onremovestream = this.handleRemoteStreamRemoved;
            if (this.isInitiatorVideo)
            {
                this.VideoPeerConnection.createOffer(this.setLocalAndSendMessage, this.handleCreateOfferError);
            }
        }
        catch (e)
        {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
        try
        {
            this.DataPeerConnection = new RTCPeerConnection(pcConfig);
            console.log('Data PeerConnection Created Successfully');
            this.DataPeerConnection.onicecandidate = this.handleIceCandidateData;
            if (this.isInitiatorDataChannel)
            {
                this.DataPeerConnection.createOffer(this.setLocalAndSendMessageData, this.handleCreateOfferError);
            }
        }
        catch (e)
        {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
    };
    this.InitiateConnections = function ()
    {
        console.log("working");
        if (this.ably && this.ably.auth && this.ably.auth.tokenDetails)
        {
            clearInterval(this.timer);
            this.channel = this.ably.channels.get(this.channelName);
            this.presence = this.channel.presence;
            this.channel.subscribe(this.channelName, function(message)
            {
                message.data = JSON.parse(message.data);
                if (message.data.userName == this.userName)
                {
                    return
                }
                if (message.data.type === 'offer')
                {
                    if (message.data.isDataChannel)
                    {
                        this.DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else
                    {
                        this.VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    this.doAnswer(message.data.isDataChannel);
                }
                else if (message.data.type === 'answer')
                {
                    if (message.data.isDataChannel)
                    {
                        this.DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else
                    {
                        this.VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                }
                else if (message.data.type === 'candidate')
                {
                    if (message.data.isDataChannel)
                    {
                        var candidate = new RTCIceCandidate(
                        {
                            sdpMLineIndex: message.data.label,
                            candidate: message.data.candidate
                        });
                        this.DataPeerConnection.addIceCandidate(candidate);
                    }
                    else
                    {
                        var candidate = new RTCIceCandidate(
                        {
                            sdpMLineIndex: message.data.label,
                            candidate: message.data.candidate
                        });
                        this.VideoPeerConnection.addIceCandidate(candidate);
                    }
                }
            });
            this.presence.enter();
            this.presence.subscribe(function(member)
            {
                if (member.clientId != this.ably.auth.tokenDetails.clientId)
                {
                    if (member.action == 'leave')
                    {
                        reset();
                    }
                    else if (member.action == 'enter')
                    {
                        this.isInitiatorVideo = true;
                        this.isInitiatorDataChannel = true;
                        this.createPeerConnection();
                    }
                }
                else if (member.clientId == this.ably.auth.tokenDetails.clientId)
                {
                    if (member.action == 'leave')
                    {
                        this.reset();
                    }
                    else if (member.action == 'enter')
                    {
                        this.isInitiatorVideo = false;
                        this.isInitiatorDataChannel = false;
                        this.createPeerConnection();
                    }
                }
            });
            this.activateButtons();
            return;
        }
        
    };
    this.activateButtons = function ()
    {
        this.startCallBtn.addEventListener("click", this.startCall);
        this.startCallBtn.disabled = true;
        this.startCallBtn.style.visibility = 'hidden';
        this.endCallBtn.addEventListener("click", this.endCall);
        this.endCallBtn.disabled = false;
        this.endCallBtn.style.visibility = 'visible';
    };
    this.startCall = function ()
    {
        if (this.callType == 'video')
        {
            navigator.mediaDevices.getUserMedia(
            {
                audio: !this.callMute,
                video: true
            }).then(this.gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
        }
        else(this.callType == 'audio')
        {
            navigator.mediaDevices.getUserMedia(
            {
                audio: !this.callMute,
                video: false
            }).then(this.gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
        }
    };
    this.gotStream = function (stream)
    {
        this.localVideoStream = stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = stream;
        video.controls = true;
        video.muted = 'muted';
        video.style.width = '100%';
        //    video.style.transform = 'rotateY(-180deg)';
        this.localVideoDiv.appendChild(video);
        this.VideoPeerConnection.addStream(this.localVideoStream);
        this.VideoPeerConnection.createOffer(this.setLocalAndSendMessage, this.handleCreateOfferError);
        this.startCallBtn.disabled = true;
        this.startCallBtn.style.visibility = 'hidden';
        this.endCallBtn.disabled = false;
        this.endCallBtn.style.visibility = 'visible';
        this.muteCallBtn.addEventListener("click", this.muteCall);
        this.muteCallBtn.disabled = false;
        this.muteCallBtn.style.visibility = 'visible';
    };
    this.handleIceCandidateData = function (event)
    {
        if (event.candidate)
        {
            this.sendMessage(
            {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                isDataChannel: true
            });
        }
        else
        {
            console.log('End of candidates.');
        }
    };
    this.handleIceCandidate = function (event)
    {
        console.log('icecandidate event: ', event);
        if (event.candidate)
        {
            this.sendMessage(
            {
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate,
                isDataChannel: false
            });
        }
        else
        {
            console.log('End of candidates.');
        }
    };
    this.handleCreateOfferError = function (event)
    {
        console.log('createOffer() error: ', event);
    };
    this.doAnswer = function (isDataChannel)
    {
        if (isDataChannel)
        {
            this.DataPeerConnection.createAnswer().then(this.setLocalAndSendMessageData, this.onCreateSessionDescriptionError);
        }
        else
        {
            this.VideoPeerConnection.createAnswer().then(this.setLocalAndSendMessage, this.onCreateSessionDescriptionError);
        }
    };
    this.setLocalAndSendMessage = function (sessionDescription)
    {
        this.VideoPeerConnection.setLocalDescription(sessionDescription);
        this.sendMessage(
        {
            type: sessionDescription.type,
            sdp: sessionDescription.sdp,
            isDataChannel: false
        });
    };
    this.setLocalAndSendMessageData = function (sessionDescription)
    {
        this.DataPeerConnection.setLocalDescription(sessionDescription);
        this.sendMessage(
        {
            type: sessionDescription.type,
            sdp: sessionDescription.sdp,
            isDataChannel: true
        });
    };
    this.onCreateSessionDescriptionError = function (error)
    {};
    this.handleRemoteStreamAdded = function (event)
    {
        this.remoteVideoStream = event.stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = event.stream;
        video.controls = true;
        video.style.width = '100%';
        this.remoteVideoDiv.appendChild(video);
    };
    this.handleRemoteStreamRemoved = function (event)
    {
        this.VideoPeerConnection.removeStream(this.remoteVideoStream);
        this.remoteVideoStream = null;
        this.remoteVideoDiv.innerHTML = '';
    };
    this.muteCall = function ()
    {
        if (!this.callMute)
        {
            var audioTracks = this.VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0)
            {
                for (var i = 0; i < audioTracks.length; ++i)
                {
                    audioTracks[i].enabled = !call_mute;
                }
            }
            this.callMute = !this.callMute;
            this.muteCallBtn.innerHTML = 'Mute';
        }
        else
        {
            var audioTracks = this.VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0)
            {
                for (var i = 0; i < audioTracks.length; ++i)
                {
                    audioTracks[i].enabled = !call_mute;
                }
            }
            this.callMute = !this.callMute;
            this.muteCallBtn.innerHTML = 'Muted';
        }
    };
    this.endCall = function ()
    {
        this.VideoPeerConnection.removeStream(this.localVideoStream);
        this.localVideoStream = null;
        this.localVideoDiv.innerHTML = '';
        this.VideoPeerConnection.createOffer(this.setLocalAndSendMessage, this.handleCreateOfferError);
        this.startCallBtn.disabled = false;
        this.startCallBtn.style.visibility = 'visible';
        this.endCallBtn.disabled = true;
        this.endCallBtn.style.visibility = 'hidden';
        this.muteCallBtn.disabled = true;
        this.muteCallBtn.style.visibility = 'hidden';
    };
    this.reset = function ()
    {
        this.VideoPeerConnection.close();
        this.VideoPeerConnection = null;
        this.isInitiatorVideo = false;
        this.DataPeerConnection.close();
        this.DataPeerConnection = null;
        this.isInitiatorDataChannel = false;
    };
}
