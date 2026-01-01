
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Mic, MicOff, Loader2, Volume2, History, MessageSquare, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Consultant: React.FC = () => {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const startSession = async () => {
    setIsConnecting(true);
    try {
      // Create fresh instance for the call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
          },
          systemInstruction: 'You are an elite jewelry expert from Sanghavi Jewel Studio. You are helping high-net-worth clients design or select bespoke luxury jewelry. Your tone is sophisticated, knowledgeable, and elegant. Speak about metal types (18k gold, platinum), gem quality (VVS clarity, D color), and bespoke craftsmanship.',
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
            } else if (message.serverContent?.inputTranscription) {
              setCurrentInput(prev => prev + message.serverContent!.inputTranscription!.text);
            }

            if (message.serverContent?.turnComplete) {
              setTranscriptions(prev => [
                ...prev, 
                { role: 'user', text: currentInput },
                { role: 'model', text: currentOutput }
              ]);
              setCurrentInput('');
              setCurrentOutput('');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            setIsActive(false);
            setIsConnecting(false);
          },
          onerror: (e) => {
            console.error("Live API Error:", e);
            setIsActive(false);
            setIsConnecting(false);
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) sessionRef.current.close();
    setIsActive(false);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  const createBlob = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' };
  };

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center p-6 md:p-12 pb-32">
      <header className="w-full max-w-4xl flex justify-between items-center mb-12">
        <button onClick={() => navigate('/')} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition">
          <ArrowLeft />
        </button>
        <div className="text-center">
          <h1 className="font-serif text-3xl font-bold text-gold-500">Bespoke Expert</h1>
          <p className="text-stone-500 text-xs uppercase tracking-[0.3em]">Sanghavi Jewel Studio</p>
        </div>
        <div className="w-12 h-12 rounded-full border border-gold-500/20 flex items-center justify-center">
            <ShieldCheck size={20} className="text-gold-500" />
        </div>
      </header>

      <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center space-y-12">
        <div className={`relative w-64 h-64 rounded-full flex items-center justify-center transition-all duration-700 ${isActive ? 'bg-gold-500/5' : 'bg-stone-800'}`}>
          <div className={`absolute inset-0 rounded-full border-2 border-gold-500/20 ${isActive ? 'animate-ping' : ''}`} />
          <button 
            onClick={isActive ? stopSession : startSession}
            disabled={isConnecting}
            className={`relative z-10 w-48 h-48 rounded-full flex items-center justify-center transition-all shadow-2xl ${
              isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-gold-600 hover:bg-gold-700 shadow-gold-600/20'
            }`}
          >
            {isConnecting ? <Loader2 className="animate-spin" size={48} /> : (isActive ? <MicOff size={48} /> : <Mic size={48} />)}
          </button>
        </div>

        <div className="text-center space-y-4">
          <h3 className="text-xl font-serif text-stone-200">
            {isActive ? "I'm listening..." : isConnecting ? "Establishing link..." : "Talk to our Jewelry Expert"}
          </h3>
        </div>

        {(currentInput || currentOutput) && (
          <div className="w-full bg-white/5 backdrop-blur border border-white/10 p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {currentInput && (
              <div className="flex gap-3">
                <History size={16} className="text-stone-500 mt-1 shrink-0" />
                <p className="text-stone-300 italic">"{currentInput}"</p>
              </div>
            )}
            {currentOutput && (
              <div className="flex gap-3 border-t border-white/5 pt-4">
                <Volume2 size={16} className="text-gold-500 mt-1 shrink-0" />
                <p className="text-white">{currentOutput}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {transcriptions.length > 0 && (
        <div className="mt-12 w-full max-w-4xl space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-500 flex items-center gap-2">
            <MessageSquare size={12} /> Conversation History
          </h4>
          <div className="space-y-4 max-h-60 overflow-y-auto pr-4 scrollbar-hide">
            {transcriptions.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  t.role === 'user' ? 'bg-stone-800 text-stone-300' : 'bg-gold-950/30 text-gold-100 border border-gold-500/20'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
