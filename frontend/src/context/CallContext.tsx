import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

let RTCPeerConnectionImpl: any;
let RTCIceCandidateImpl: any;
let RTCSessionDescriptionImpl: any;
let mediaDevicesImpl: any;
let MediaStreamImpl: any;

if (Platform.OS === 'web') {
  RTCPeerConnectionImpl = globalThis.RTCPeerConnection;
  RTCIceCandidateImpl = globalThis.RTCIceCandidate;
  RTCSessionDescriptionImpl = globalThis.RTCSessionDescription;
  mediaDevicesImpl = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  MediaStreamImpl = globalThis.MediaStream;
} else {
  try {
    const webrtc = require('react-native-webrtc');
    RTCPeerConnectionImpl = webrtc.RTCPeerConnection;
    RTCIceCandidateImpl = webrtc.RTCIceCandidate;
    RTCSessionDescriptionImpl = webrtc.RTCSessionDescription;
    mediaDevicesImpl = webrtc.mediaDevices;
    MediaStreamImpl = webrtc.MediaStream;
  } catch (e) {
    console.warn(
      'WebRTC native module not found. Calls require a custom dev build. Run `npx expo run:android`.'
    );
  }
}

type CallState = 'IDLE' | 'RINGING' | 'CONNECTED' | 'REJECTED' | 'ENDED';

interface CallContextType {
  localStream: any;
  remoteStream: any;
  callState: CallState;
  isIncoming: boolean;
  partnerInfo: any;
  isVideoCall: boolean;
  initiateCall: (pairId: string, partner: any, isVideo: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  isMuted: boolean;
  isCameraOff: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [isIncoming, setIsIncoming] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState<any>(null);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [remoteSdp, setRemoteSdp] = useState<any>(null);

  const pc = useRef<any>(null);
  const inboundChannel = useRef<any>(null);
  const outboundChannel = useRef<any>(null);
  const callStateRef = useRef<CallState>('IDLE');

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const removeChannel = useCallback((channelRef: React.MutableRefObject<any>) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const resetCallState = useCallback(() => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }

    removeChannel(outboundChannel);

    setRemoteSdp(null);
    setRemoteStream(null);
    setCallState('IDLE');
    setIsIncoming(false);
    setPartnerInfo(null);
    setActivePairId(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsVideoCall(false);

    setLocalStream((currentStream: any) => {
      if (currentStream) {
        currentStream.getTracks().forEach((track: any) => track.stop());
      }
      return null;
    });
  }, [removeChannel]);

  const ensureOutboundChannel = useCallback((targetUserId: string) => {
    removeChannel(outboundChannel);

    const channel = supabase.channel(`calls:${targetUserId}`);
    outboundChannel.current = channel;
    channel.subscribe(); // fire-and-forget; broadcast works immediately
    return channel;
  }, [removeChannel]);

  const sendSignal = useCallback(async (event: string, payload: Record<string, any>) => {
    if (!outboundChannel.current) {
      throw new Error('Call signaling channel is not ready');
    }

    await outboundChannel.current.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  const cleanup = useCallback(() => {
    resetCallState();
  }, [resetCallState]);

  useEffect(() => {
    if (!user) return;

    const globalChannel = supabase.channel(`calls:${user.id}`)
      .on('broadcast', { event: 'call-offer' }, async ({ payload }: any) => {
        if (!payload || payload.senderInfo?.id === user.id) return;

        if (callStateRef.current !== 'IDLE') {
          return;
        }

        setPartnerInfo(payload.senderInfo);
        setActivePairId(payload.pairId);
        setRemoteSdp(payload.sdp);
        setIsIncoming(true);
        setIsVideoCall(!!payload.isVideo);
        setIsCameraOff(!payload.isVideo);
        setCallState('RINGING');
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }: any) => {
        if (!pc.current || !payload?.candidate) return;

        try {
          await pc.current.addIceCandidate(new RTCIceCandidateImpl(payload.candidate));
        } catch (error) {
          console.error('Failed to add ICE candidate:', error);
        }
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }: any) => {
        if (!pc.current || !payload?.sdp) return;

        try {
          await pc.current.setRemoteDescription(new RTCSessionDescriptionImpl(payload.sdp));
          setCallState('CONNECTED');
        } catch (error) {
          console.error('Failed to set remote answer:', error);
        }
      })
      .on('broadcast', { event: 'call-hangup' }, () => {
        cleanup();
      })
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Incoming call channel error for user:', user.id);
        }
      });

    inboundChannel.current = globalChannel;

    return () => {
      supabase.removeChannel(globalChannel);
      inboundChannel.current = null;
      cleanup();
    };
  }, [cleanup, user]);

  const setupPeerConnection = useCallback(async (partnerId: string, wantsVideo: boolean) => {
    if (!RTCPeerConnectionImpl || !mediaDevicesImpl?.getUserMedia) {
      throw new Error('WebRTC is not available on this device');
    }

    if (pc.current) {
      pc.current.close();
    }

    await ensureOutboundChannel(partnerId);

    pc.current = new RTCPeerConnectionImpl(configuration);

    pc.current.onicecandidate = async (event: any) => {
      if (!event.candidate) return;

      try {
        await sendSignal('ice-candidate', { candidate: event.candidate });
      } catch (error) {
        console.error('Failed to send ICE candidate:', error);
      }
    };

    pc.current.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        return;
      }

      if (MediaStreamImpl && event.track) {
        setRemoteStream((currentStream: any) => {
          const stream = currentStream || new MediaStreamImpl();
          stream.addTrack(event.track);
          return stream;
        });
      }
    };

    const stream = await mediaDevicesImpl.getUserMedia({
      audio: true,
      video: wantsVideo,
    });

    setLocalStream((currentStream: any) => {
      if (currentStream) {
        currentStream.getTracks().forEach((track: any) => track.stop());
      }
      return stream;
    });

    setIsCameraOff(!wantsVideo);
    stream.getTracks().forEach((track: any) => pc.current?.addTrack(track, stream));
  }, [ensureOutboundChannel, sendSignal]);

  const initiateCall = async (pairId: string, partner: any, isVideo: boolean) => {
    try {
      if (!user) return;

      setPartnerInfo(partner);
      setActivePairId(pairId);
      setCallState('RINGING');
      setIsIncoming(false);
      setIsVideoCall(isVideo);
      setRemoteSdp(null);

      await setupPeerConnection(partner.id, isVideo);

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      await sendSignal('call-offer', {
        sdp: offer,
        senderInfo: {
          id: user.id,
          name: user.email?.split('@')[0],
          email: user.email,
        },
        pairId,
        isVideo,
      });
    } catch (error: any) {
      console.error('Call start failed:', error);
      Alert.alert('Call failed', error?.message || 'Could not start the call.');
      cleanup();
    }
  };

  const acceptCall = async () => {
    try {
      if (!partnerInfo || !activePairId || !remoteSdp) return;

      await setupPeerConnection(partnerInfo.id, !isCameraOff);

      await pc.current.setRemoteDescription(new RTCSessionDescriptionImpl(remoteSdp));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      await sendSignal('call-answer', { sdp: answer });
      setCallState('CONNECTED');
    } catch (error: any) {
      console.error('Call accept failed:', error);
      Alert.alert('Call failed', error?.message || 'Could not answer the call.');
      cleanup();
    }
  };

  const rejectCall = async () => {
    if (partnerInfo) {
      try {
        await ensureOutboundChannel(partnerInfo.id);
        await sendSignal('call-hangup', { reason: 'rejected' });
      } catch (error) {
        console.error('Failed to reject call:', error);
      }
    }
    cleanup();
  };

  const endCall = async () => {
    if (partnerInfo) {
      try {
        await ensureOutboundChannel(partnerInfo.id);
        await sendSignal('call-hangup', { reason: 'ended' });
      } catch (error) {
        console.error('Failed to end call:', error);
      }
    }
    cleanup();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track: any) => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track: any) => track.enabled = !track.enabled);
      setIsCameraOff(!isCameraOff);
    }
  };

  return (
    <CallContext.Provider value={{
      localStream,
      remoteStream,
      callState,
      isIncoming,
      partnerInfo,
      isVideoCall,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
      isMuted,
      isCameraOff
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
