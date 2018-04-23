'use strict';
function WebrtcConnection(userName, channelName, pcConfig, startCallBtn, endCallBtn, muteCallBtn, localVideoDiv, remoteVideoDiv,
        callType)
{

        var self = this;
        self.userName = userName;
        self.channelName = channelName;
        self.pcConfig = pcConfig;
        self.isInitiatorVideo = false;
        self.isInitiatorDataChannel = false;
        self.localVideoStream = undefined;
        self.remoteVideoStream = undefined;
        self.localVideoDiv = localVideoDiv;
        self.remoteVideoDiv = remoteVideoDiv;
        self.VideoPeerConnection = undefined;
        self.DataPeerConnection = undefined;
        self.presence = undefined;
        self.channel = undefined;
        self.ably = new Ably.Realtime(
        {
            authUrl: '/auth/api/' + self.channelName
        });
        // console.log(self.ably);
        self.timer = setInterval(self.InitiateConnections, 500);
        self.callType = callType;
        self.callMute = false;
        self.startCallBtn = startCallBtn;
        self.endCallBtn = endCallBtn;
        self.startCallBtn.disabled = false;
        self.startCallBtn.style.visibility = 'visible';
        self.endCallBtn.disabled = true;
        self.endCallBtn.style.visibility = 'hidden';
        self.muteCallBtn = muteCallBtn;
        self.muteCallBtn.disabled = true;
        self.muteCallBtn.style.visibility = 'hidden';

}



    WebrtcConnection.prototype.sendMessage  = function(message)
    {
        message['userName'] = self.userName;
        self.channel.publish(self.channelName, JSON.stringify(message));
        console.log('Message Sent on Channel' + self.channelName);
    };
    WebrtcConnection.prototype.createPeerConnection   = function()
    {
        try
        {
            self.VideoPeerConnection = new RTCPeerConnection(self.pcConfig);
            console.log('Video PeerConnection Created Successfully');
            self.VideoPeerConnection.onicecandidate = self.handleIceCandidate;
            self.VideoPeerConnection.onaddstream = self.handleRemoteStreamAdded;
            self.VideoPeerConnection.onremovestream = self.handleRemoteStreamRemoved;
            if (self.isInitiatorVideo)
            {
                self.VideoPeerConnection.createOffer(self.setLocalAndSendMessage, self.handleCreateOfferError);
            }
        }
        catch (e)
        {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
        try
        {
            self.DataPeerConnection = new RTCPeerConnection(pcConfig);
            console.log('Data PeerConnection Created Successfully');
            self.DataPeerConnection.onicecandidate = self.handleIceCandidateData;
            if (self.isInitiatorDataChannel)
            {
                self.DataPeerConnection.createOffer(self.setLocalAndSendMessageData, self.handleCreateOfferError);
            }
        }
        catch (e)
        {
            console.log('Failed to create Video PeerConnection, exception: ' + e.message);
        }
    };
    WebrtcConnection.prototype.InitiateConnections   = function()
    {
        console.log(self.ably);
        if (self.ably && self.ably.auth && self.ably.auth.tokenDetails)
        {
            clearInterval(self.timer);
            self.channel = self.ably.channels.get(self.channelName);
            self.presence = self.channel.presence;
            self.channel.subscribe(self.channelName, function(message)
            {
                message.data = JSON.parse(message.data);
                if (message.data.userName == self.userName)
                {
                    return
                }
                if (message.data.type === 'offer')
                {
                    if (message.data.isDataChannel)
                    {
                        self.DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else
                    {
                        self.VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    self.doAnswer(message.data.isDataChannel);
                }
                else if (message.data.type === 'answer')
                {
                    if (message.data.isDataChannel)
                    {
                        self.DataPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    }
                    else
                    {
                        self.VideoPeerConnection.setRemoteDescription(new RTCSessionDescription(message.data));
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
                        self.DataPeerConnection.addIceCandidate(candidate);
                    }
                    else
                    {
                        var candidate = new RTCIceCandidate(
                        {
                            sdpMLineIndex: message.data.label,
                            candidate: message.data.candidate
                        });
                        self.VideoPeerConnection.addIceCandidate(candidate);
                    }
                }
            });
            self.presence.enter();
            self.presence.subscribe(function(member)
            {
                if (member.clientId != self.ably.auth.tokenDetails.clientId)
                {
                    if (member.action == 'leave')
                    {
                        reset();
                    }
                    else if (member.action == 'enter')
                    {
                        self.isInitiatorVideo = true;
                        self.isInitiatorDataChannel = true;
                        self.createPeerConnection();
                    }
                }
                else if (member.clientId == self.ably.auth.tokenDetails.clientId)
                {
                    if (member.action == 'leave')
                    {
                        self.reset();
                    }
                    else if (member.action == 'enter')
                    {
                        self.isInitiatorVideo = false;
                        self.isInitiatorDataChannel = false;
                        self.createPeerConnection();
                    }
                }
            });
            self.activateButtons();

        }
        return;
    };
    WebrtcConnection.prototype.activateButtons   = function()
    {
        self.startCallBtn.addEventListener("click", self.startCall);
        self.startCallBtn.disabled = true;
        self.startCallBtn.style.visibility = 'hidden';
        self.endCallBtn.addEventListener("click", self.endCall);
        self.endCallBtn.disabled = false;
        self.endCallBtn.style.visibility = 'visible';
    };
    WebrtcConnection.prototype.startCall = function()
    {
        if (self.callType == 'video')
        {
            navigator.mediaDevices.getUserMedia(
            {
                audio: !self.callMute,
                video: true
            }).then(self.gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
        }
        else(self.callType == 'audio')
        {
            navigator.mediaDevices.getUserMedia(
            {
                audio: !self.callMute,
                video: false
            }).then(self.gotStream).catch(function(e)
            {
                alert('getUserMedia() error: ' + e.name);
            });
        }
    };
    WebrtcConnection.prototype.gotStream = function(stream)
    {
        self.localVideoStream = stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = stream;
        video.controls = true;
        video.muted = 'muted';
        video.style.width = '100%';
        //    video.style.transform = 'rotateY(-180deg)';
        self.localVideoDiv.appendChild(video);
        self.VideoPeerConnection.addStream(self.localVideoStream);
        self.VideoPeerConnection.createOffer(self.setLocalAndSendMessage, self.handleCreateOfferError);
        self.startCallBtn.disabled = true;
        self.startCallBtn.style.visibility = 'hidden';
        self.endCallBtn.disabled = false;
        self.endCallBtn.style.visibility = 'visible';
        self.muteCallBtn.addEventListener("click", self.muteCall);
        self.muteCallBtn.disabled = false;
        self.muteCallBtn.style.visibility = 'visible';
    };
    WebrtcConnection.prototype.handleIceCandidateData = function(event)
    {
        if (event.candidate)
        {
            self.sendMessage(
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
    WebrtcConnection.prototype.handleIceCandidate = function(event)
    {
        console.log('icecandidate event: ', event);
        if (event.candidate)
        {
            self.sendMessage(
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
    WebrtcConnection.prototype.handleCreateOfferError = function(event)
    {
        console.log('createOffer() error: ', event);
    };
    WebrtcConnection.prototype.doAnswer = function(isDataChannel)
    {
        if (isDataChannel)
        {
            self.DataPeerConnection.createAnswer().then(self.setLocalAndSendMessageData, self.onCreateSessionDescriptionError);
        }
        else
        {
            self.VideoPeerConnection.createAnswer().then(self.setLocalAndSendMessage, self.onCreateSessionDescriptionError);
        }
    };
    WebrtcConnection.prototype.setLocalAndSendMessage = function(sessionDescription)
    {
        self.VideoPeerConnection.setLocalDescription(sessionDescription);
        self.sendMessage(
        {
            type: sessionDescription.type,
            sdp: sessionDescription.sdp,
            isDataChannel: false
        });
    };
    WebrtcConnection.prototype.setLocalAndSendMessageData = function(sessionDescription)
    {
        self.DataPeerConnection.setLocalDescription(sessionDescription);
        self.sendMessage(
        {
            type: sessionDescription.type,
            sdp: sessionDescription.sdp,
            isDataChannel: true
        });
    };
    WebrtcConnection.prototype.onCreateSessionDescriptionError = function(error)
    {};
    WebrtcConnection.prototype.handleRemoteStreamAdded = function(event)
    {
        self.remoteVideoStream = event.stream;
        var video = document.createElement("video");
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = event.stream;
        video.controls = true;
        video.style.width = '100%';
        self.remoteVideoDiv.appendChild(video);
    };
    WebrtcConnection.prototype.handleRemoteStreamRemoved = function(event)
    {
        self.VideoPeerConnection.removeStream(self.remoteVideoStream);
        self.remoteVideoStream = null;
        self.remoteVideoDiv.innerHTML = '';
    };
    WebrtcConnection.prototype.muteCall = function()
    {
        if (!self.callMute)
        {
            var audioTracks = self.VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0)
            {
                for (var i = 0; i < audioTracks.length; ++i)
                {
                    audioTracks[i].enabled = !call_mute;
                }
            }
            self.callMute = !self.callMute;
            self.muteCallBtn.innerHTML = 'Mute';
        }
        else
        {
            var audioTracks = self.VideoPeerConnection.getLocalStreams()[0].getAudioTracks();
            if (audioTracks.length !== 0)
            {
                for (var i = 0; i < audioTracks.length; ++i)
                {
                    audioTracks[i].enabled = !call_mute;
                }
            }
            self.callMute = !self.callMute;
            self.muteCallBtn.innerHTML = 'Muted';
        }
    };
    WebrtcConnection.prototype.endCall = function()
    {
        self.VideoPeerConnection.removeStream(self.localVideoStream);
        self.localVideoStream = null;
        self.localVideoDiv.innerHTML = '';
        self.VideoPeerConnection.createOffer(self.setLocalAndSendMessage, self.handleCreateOfferError);
        self.startCallBtn.disabled = false;
        self.startCallBtn.style.visibility = 'visible';
        self.endCallBtn.disabled = true;
        self.endCallBtn.style.visibility = 'hidden';
        self.muteCallBtn.disabled = true;
        self.muteCallBtn.style.visibility = 'hidden';
    };
    WebrtcConnection.prototype.reset = function()
    {
        self.VideoPeerConnection.close();
        self.VideoPeerConnection = null;
        self.isInitiatorVideo = false;
        self.DataPeerConnection.close();
        self.DataPeerConnection = null;
        self.isInitiatorDataChannel = false;
    };
