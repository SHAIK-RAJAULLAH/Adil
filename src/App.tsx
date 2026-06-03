import React, { useState, useEffect, useRef } from "react";
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Award, 
  Clock, 
  Play, 
  RefreshCw, 
  Bot, 
  User, 
  ChevronRight, 
  Flame, 
  X, 
  BookOpen, 
  Lightbulb, 
  Activity,
  ThumbsUp,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Message, VoiceConfig, MistakeDetail } from "./types";

// Standard pre-suggested topics list
const PREBUILT_TOPICS = [
  {
    id: "daily_routines",
    title: "Daily Life & Routines",
    description: "Talk about your typical day, stress management, and hobbies.",
    systemTopic: "Daily Life & Routines"
  },
  {
    id: "future_ai",
    title: "The Future of Artificial Intelligence",
    description: "Express your opinions on how AI is shaping careers, education, and society.",
    systemTopic: "The Future of Artificial Intelligence"
  },
  {
    id: "travel_experience",
    title: "Memorable Travel or Culture",
    description: "Share details of a vacation, local custom, or places you dream of visiting.",
    systemTopic: "Memorable Travel or Culture"
  },
  {
    id: "challenging_situation",
    title: "Overcoming a Challenge",
    description: "Explain a difficult academic or career setback and how you solved it.",
    systemTopic: "Overcoming a Challenge"
  },
  {
    id: "role_play_interview",
    title: "Job Interview Simulation",
    description: "Practice answering behavioral and dream career interview questions.",
    systemTopic: "Job Interview Simulation"
  }
];

export default function App() {
  // Navigation & Flow state: 'setup' | 'session' | 'report'
  const [appState, setAppState] = useState<'setup' | 'session' | 'report'>('setup');

  // Voice Speech Synthesis setups
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Configuration setups
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [sessionTargetMinutes, setSessionTargetMinutes] = useState<number>(10);

  // Active Session state
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [isCoachThinking, setIsCoachThinking] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false); // TTS playing

  // Cumulative Session analytics cached for final report
  const [totalMistakesCount, setTotalMistakesCount] = useState<number>(0);
  const [allSessionMistakes, setAllSessionMistakes] = useState<MistakeDetail[]>([]);
  const [totalWordsSpoken, setTotalWordsSpoken] = useState<number>(0);
  const [fluencyTipsCollected, setFluencyTipsCollected] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // UI Highlight for current evaluated sentence feedback (Flashes in panel highlight)
  const [activeFeedbackIndex, setActiveFeedbackIndex] = useState<number | null>(null);

  // Audio input/Speech Typing recognition
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // UI Refs for scrolling
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Speech synthesis load
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices.filter(v => v.lang.startsWith("en")));
        
        // Pick smart default female voice
        const femaleDefault = availableVoices.find(v => 
          v.lang.startsWith("en") && 
          (v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Hazel") || v.name.includes("Zira"))
        );
        if (femaleDefault) {
          setSelectedVoiceName(femaleDefault.name);
        } else if (availableVoices.length > 0) {
          setSelectedVoiceName(availableVoices[0].name);
        }
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Update Voice preference named match based on gender choice
  useEffect(() => {
    if (voices.length > 0) {
      const englishVoices = voices.filter(v => v.lang.startsWith("en"));
      if (voiceGender === 'female') {
        const female = englishVoices.find(v => 
          v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Hazel") || v.name.includes("Zira") || v.name.includes("Victoria") || v.name.includes("Karen")
        );
        if (female) setSelectedVoiceName(female.name);
      } else {
        const male = englishVoices.find(v => 
          v.name.includes("Male") || v.name.includes("Daniel") || v.name.includes("David") || v.name.includes("George") || v.name.includes("Richard")
        );
        if (male) setSelectedVoiceName(male.name);
      }
    }
  }, [voiceGender, voices]);

  // Handle timer
  useEffect(() => {
    let interval: any = null;
    if (timerActive) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isCoachThinking]);

  // Voice speech synthesis read aloud
  const handleReadAloud = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || isMuted) return;

    window.speechSynthesis.cancel(); // Stifle any ongoing speech
    
    // Clean text of markdown before reading
    const cleanText = text.replace(/[*_#`[\]()]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const chosenVoice = voices.find(v => v.name === selectedVoiceName);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Setup Web Speech Recognition API if available
  const startSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech typing (Speech Recognition) is unfortunately not fully supported in your current browser. Please try Chrome or Safari, or type manually!");
      return;
    }

    if (!recognitionRef.current) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        if (resultText) {
          setUserInput(prev => prev ? prev + " " + resultText : resultText);
        }
      };

      rec.onerror = (err: any) => {
        console.error("Speech typing error:", err);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Already listening", e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Launch Session
  const handleStartSession = async () => {
    const finalTopic = selectedTopic === "custom" ? customTopic : PREBUILT_TOPICS.find(t => t.id === selectedTopic)?.title || "Free English Talk";
    if (!finalTopic.trim()) {
      alert("Please specify or select a conversation topic to continue!");
      return;
    }

    // Reset session parameters
    setMessages([]);
    setElapsedSeconds(0);
    setTotalMistakesCount(0);
    setAllSessionMistakes([]);
    setTotalWordsSpoken(0);
    setFluencyTipsCollected([]);
    setAppState('session');
    setTimerActive(true);
    setIsCoachThinking(true);
    setApiError(null);

    // Initial Greeting from Coach
    try {
      const greetingPrompt = `Greet the user as Coach Avery. The client chosen target conversation topic is "${finalTopic}". Make your greeting highly engaging, warm, set expectations, and prompt them with a simple starting question to get them talking. Keep it within 2-3 sentences.`;
      
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: finalTopic,
          voiceGender,
          messages: [],
          currentUtterance: greetingPrompt
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.details || data.error);
      }

      const initialMessage: Message = {
        id: "msg_init",
        role: "assistant",
        text: data.conversationalResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([initialMessage]);
      setTimeout(() => {
        handleReadAloud(data.conversationalResponse);
      }, 500);
    } catch (err: any) {
      console.error(err);
      setApiError("Unable to initialize coach conversation connection. Please verify your internet connection or Gemini API Key.");
    } finally {
      setIsCoachThinking(false);
    }
  };

  // User submits a sentence in chat interaction
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isCoachThinking) return;

    const sentenceToVerify = userInput.trim();
    setUserInput("");
    stopSpeechRecognition();

    // Cache count of words
    const userWords = sentenceToVerify.split(/\s+/).filter(Boolean).length;
    setTotalWordsSpoken(prev => prev + userWords);

    // Create client message
    const userMsg: Message = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      text: sentenceToVerify,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsCoachThinking(true);
    setApiError(null);

    try {
      const topicString = selectedTopic === "custom" ? customTopic : PREBUILT_TOPICS.find(t => t.id === selectedTopic)?.title || "Free English Talk";
      
      // Sending payload to our Server-side API endpoint
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicString,
          voiceGender,
          messages: messages.slice(-8), // Send sliding window context
          currentUtterance: sentenceToVerify
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      // Add unique IDs to grammar mistakes
      const mistakesWithIds: MistakeDetail[] = (data.evaluation?.mistakes || []).map((m: any, idx: number) => ({
        ...m,
        id: `mst_${Date.now()}_${idx}`
      }));

      // Create assistant reply with attached grammatical and structural evaluation
      const assistantMsg: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        text: data.conversationalResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        evaluation: {
          hasMistakes: !!data.evaluation?.hasMistakes,
          mistakes: mistakesWithIds,
          fluencyTip: data.evaluation?.fluencyTip || "",
          generalComment: data.evaluation?.generalComment || ""
        }
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      // Accumulate mistakes for report
      if (mistakesWithIds.length > 0) {
        setTotalMistakesCount(prev => prev + mistakesWithIds.length);
        setAllSessionMistakes(prev => [...prev, ...mistakesWithIds]);
      }
      
      if (data.evaluation?.fluencyTip) {
        setFluencyTipsCollected(prev => [...prev, data.evaluation.fluencyTip]);
      }

      // Highlight newest evaluated bubble instantly
      setActiveFeedbackIndex(messages.length + 1);

      // Playback voice
      handleReadAloud(data.conversationalResponse);

    } catch (err: any) {
      console.error(err);
      setApiError("We had a hiccup analyzing the audio statement. Please try submitting again.");
    } finally {
      setIsCoachThinking(false);
    }
  };

  // Conclude coaching session & direct to performance review
  const handleEndSession = () => {
    setTimerActive(false);
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    setAppState('report');
  };

  // Re-track time format
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Fluency Accuracy progress scoring metrics
  const calculateFluencyPercentage = () => {
    if (totalWordsSpoken === 0) return 100;
    // Standard rule constraint calculation: 100 - (Mistakes per 50 words)
    const factor = (totalMistakesCount / totalWordsSpoken) * 100;
    const rating = Math.max(25, Math.min(100, Math.round(100 - factor)));
    return rating;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col justify-between" id="applet-root">
      
      {/* Top Professional Navigation Header Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between" id="app-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Eloquence Coach</h1>
            <p className="text-xs text-slate-500 font-medium">Real-time English Fluency & Accourding Assistant</p>
          </div>
        </div>

        {appState === 'session' && (
          <div className="flex items-center gap-6" id="session-indicators">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100 text-teal-700" title="Active Duration">
              <Clock className="w-4 h-4 animate-pulse text-teal-600" />
              <span className="font-mono font-semibold text-sm">{formatTime(elapsedSeconds)}</span>
              <span className="text-xs font-medium text-slate-400">/ {sessionTargetMinutes}:00</span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsMuted(prev => {
                  if (!prev) window.speechSynthesis?.cancel();
                  return !prev;
                })}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title={isMuted ? "Unmute Coach Voice" : "Mute Coach Voice"}
                id="btn-voice-mute"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-teal-600" />}
              </button>

              <button 
                onClick={handleEndSession}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm"
                id="btn-finish-session"
              >
                End Practice Session
              </button>
            </div>
          </div>
        )}

        {appState === 'report' && (
          <button 
            onClick={() => setAppState('setup')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-all"
            id="btn-restart-setup"
          >
            <RefreshCw className="w-4 h-4" />
            Switch Topic & Restart
          </button>
        )}
      </header>

      {/* Primary Application Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col justify-start" id="main-workbench">
        <AnimatePresence mode="wait">
          
          {/* STEP 1: PRACTICE SETUP FORM */}
          {appState === 'setup' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4"
              id="setup-view-wrapper"
            >
              {/* Setup Controls Pane */}
              <div className="lg:col-span-7 space-y-6 bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm" id="setup-form">
                <div>
                  <span className="px-3 py-1 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-semibold uppercase tracking-wider">
                    Interactive Coach Avery
                  </span>
                  <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight mt-3">
                    Unlock Your Authentic English Voice
                  </h2>
                  <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                    Improve speech patterns, polish accent structures, and overcome mental blocks. Coach Avery talks with you, tracks spelling/grammar mistakes, and maps corrections.
                  </p>
                </div>

                <div className="border-t border-slate-100 my-4" />

                {/* Choosing Voice Style */}
                <div className="space-y-3" id="config-voice">
                  <label className="block text-sm font-semibold text-slate-700">1. Adjust Voice Tone Preferences</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setVoiceGender('female')}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        voiceGender === 'female' 
                          ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-600/10' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      id="btn-voice-female"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-sm text-slate-900">Warm Female Voice</span>
                        {voiceGender === 'female' && <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />}
                      </div>
                      <span className="text-xs text-slate-400 mt-2">Smooth, clear, highly patient British/US accents.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVoiceGender('male')}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        voiceGender === 'male' 
                          ? 'border-teal-500 bg-teal-50/50 ring-2 ring-teal-600/10' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      id="btn-voice-male"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-semibold text-sm text-slate-900">Polished Male Voice</span>
                        {voiceGender === 'male' && <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />}
                      </div>
                      <span className="text-xs text-slate-400 mt-2">Professional, steady corporate-sounding accent.</span>
                    </button>
                  </div>

                  {voices.length > 0 && (
                    <div className="mt-2 text-xs flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-500 font-medium">Auto-matched Engine Voice:</span>
                      <select 
                        value={selectedVoiceName} 
                        onChange={(e) => {
                          setSelectedVoiceName(e.target.value);
                          // Auto trigger short test utterance to show voice of user's choice
                          setTimeout(() => {
                            const u = new SpeechSynthesisUtterance("Hello, I am ready to practice English with you.");
                            const cv = voices.find(v => v.name === e.target.value);
                            if (cv) u.voice = cv;
                            window.speechSynthesis?.speak(u);
                          }, 200);
                        }}
                        className="text-xs text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none font-medium max-w-[220px]"
                      >
                        {voices.map(v => (
                          <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Choosing Topic of Discussion */}
                <div className="space-y-3" id="config-topic">
                  <label className="block text-sm font-semibold text-slate-700">2. Choose Conversation Topic</label>
                  <p className="text-xs text-slate-400">Select an engaging scenario or type a specific topic you love exploring.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PREBUILT_TOPICS.map((topic) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopic(topic.id)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          selectedTopic === topic.id 
                            ? 'border-teal-500 bg-teal-50/25 ring-1 ring-teal-500' 
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                        id={`btn-topic-${topic.id}`}
                      >
                        <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                          {topic.title}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal line-clamp-2">
                          {topic.description}
                        </p>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setSelectedTopic('custom')}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        selectedTopic === 'custom' 
                          ? 'border-teal-500 bg-teal-50/25 ring-1 ring-teal-500' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                      id="btn-topic-custom"
                    >
                      <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        Custom Creative Choice
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 complex-leading truncate">
                        Write down any desired hobby, fantasy topic or technical discussion.
                      </p>
                    </button>
                  </div>

                  {selectedTopic === "custom" && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 space-y-1"
                    >
                      <input 
                        type="text"
                        placeholder="e.g. My favorite sci-fi book series, cloud computing basics..."
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                        id="input-custom-topic"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Choosing Target Practice Duration */}
                <div className="space-y-3" id="config-duration">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-semibold text-slate-700">3. Target Practice Length</label>
                    <span className="text-xs font-semibold text-teal-700 px-2 py-0.5 rounded-full bg-teal-50">{sessionTargetMinutes} minutes</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[10, 15, 20].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setSessionTargetMinutes(mins)}
                        className={`py-2 text-sm font-semibold rounded-xl border text-center transition-all ${
                          sessionTargetMinutes === mins 
                            ? 'border-teal-500 bg-teal-50/50 text-teal-700 ring-1 ring-teal-500' 
                            : 'border-slate-200 hover:border-slate-300 text-slate-500 bg-white'
                        }`}
                        id={`btn-duration-${mins}`}
                      >
                        {mins} minutes
                      </button>
                    ))}
                  </div>
                </div>

                {/* Launch Action */}
                <button
                  onClick={handleStartSession}
                  className="w-full group mt-4 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm hover:translate-y-[-1px] transition-all shadow-sm flex items-center justify-center gap-2"
                  id="btn-start-coaching"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Initiate Practice Session with Coach Avery
                </button>
              </div>

              {/* Guide/Sidebar layout showcasing capabilities */}
              <div className="lg:col-span-5 space-y-6" id="setup-instruction-pane">
                {/* Method walkthrough */}
                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-600 animate-pulse" />
                    Our Core Training Methodology
                  </h3>
                  <div className="space-y-4 text-xs leading-relaxed text-slate-500">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-700 font-bold flex-shrink-0">1</div>
                      <div>
                        <h4 className="font-semibold text-slate-850 text-slate-950 mb-0.5">Spoken or Text-driven Input</h4>
                        <p>Express thoughts freely using voice dictation or typing. Use standard English to explain the chosen scenario.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-700 font-bold flex-shrink-0">2</div>
                      <div>
                        <h4 className="font-semibold text-slate-850 text-slate-950 mb-0.5">Double-Headed Coach Response</h4>
                        <p>Avery replies conversationally back to keep the dialogue flowing naturally, while evaluating your syntax/grammar in the background.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-700 font-bold flex-shrink-0">3</div>
                      <div>
                        <h4 className="font-semibold text-slate-850 text-slate-950 mb-0.5">Instant Corrective Blueprint</h4>
                        <p>The panel automatically highlights exact mistakes, shows corrected standard sentences and suggests superior vocabulary options.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Wave Card */}
                <div className="bg-[#0f172a] rounded-2xl p-6 text-white text-center space-y-4 relative overflow-hidden shadow-md">
                  <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
                  <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-teal-400/5 rounded-full blur-2xl" />

                  <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 mx-auto">
                    <Bot className="w-6 h-6 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight">Audio Speech Sythesizer active</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Adjust your microphone, plug in your headphones, and fully immerse yourself in English discussion.
                    </p>
                  </div>

                  <div className="flex justify-center items-center gap-1.5 h-8">
                    {[1, 2, 3, 4, 5, 4, 3, 2, 1, 3, 5, 2, 4, 1].map((h, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-teal-500/40 rounded-full transition-all"
                        style={{ height: `${h * 4}px` }} 
                      />
                    ))}
                  </div>

                  <span className="inline-block text-[10px] uppercase font-mono tracking-wider font-semibold text-teal-400 px-2.5 py-1 rounded bg-teal-500/10">
                    Offline Synthesis Enabled
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: ACTIVE ENGLISH COACHING BOARD */}
          {appState === 'session' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]"
              id="active-session-workbench"
            >
              
              {/* Left Segment: Active Chat Feed (8 Cols) */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 flex flex-col justify-between shadow-sm overflow-hidden" id="chat-frame">
                
                {/* Topic and Timer Header Subbar */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600 block animate-pulse" />
                    <span className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wide">English Session Mode</span>
                    <span className="text-slate-350">|</span>
                    <span className="text-xs text-slate-700 font-semibold truncate max-w-[280px]">
                      Topic: {selectedTopic === "custom" ? customTopic : PREBUILT_TOPICS.find(t => t.id === selectedTopic)?.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Target target rating:</span>
                    <span className="text-xs font-bold text-teal-600">{calculateFluencyPercentage()}% Acc.</span>
                  </div>
                </div>

                {/* Messages Chat Stream */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4" id="chat-scroller">
                  {messages.map((message, index) => {
                    const isUser = message.role === 'user';
                    const hasMistakes = message.evaluation?.hasMistakes;
                    
                    return (
                      <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}>
                        {/* Avatar illustration indicators */}
                        {!isUser && (
                          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white text-xs font-bold font-mono">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}

                        <div className="space-y-1 max-w-[85%]">
                          <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                            isUser 
                              ? "bg-slate-850 bg-slate-900 text-white rounded-tr-none" 
                              : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"
                          }`}>
                            <p>{message.text}</p>
                            
                            {/* Read Aloud button for AI coaching bubbles */}
                            {!isUser && (
                              <button 
                                onClick={() => handleReadAloud(message.text)}
                                className="mt-2 text-[11px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                                Speak Phrasing
                              </button>
                            )}
                          </div>

                          {/* Quick visual feedback pill directly beneath messaging block */}
                          {isUser && messages[index+1]?.evaluation && (
                            <div className="flex gap-2">
                              {messages[index+1].evaluation?.hasMistakes ? (
                                <button 
                                  onClick={() => setActiveFeedbackIndex(index + 1)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-[11px] text-amber-700 font-semibold cursor-pointer hover:bg-amber-100 transition-all shadow-sm"
                                >
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  {messages[index+1].evaluation?.mistakes.length} Correction(s) detected - Learn standard
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] text-emerald-700 font-semibold shadow-sm">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Perfect Sentence Formation!
                                </div>
                              )}
                            </div>
                          )}

                          <span className="text-[10px] text-slate-400 block px-1 text-right">{message.timestamp}</span>
                        </div>

                        {isUser && (
                          <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold uppercase">
                            <User className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Coach typing visual indicator */}
                  {isCoachThinking && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
                        <Bot className="w-4 h-4 animate-bounce" />
                      </div>
                      <div className="bg-slate-100 border border-slate-200 p-4 rounded-2xl rounded-tl-none max-w-[280px]">
                        <div className="flex items-center gap-1.5 justify-center">
                          <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">Avery is analyzing sentence layout...</span>
                      </div>
                    </div>
                  )}

                  {apiError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs flex items-start gap-2 max-w-md mx-auto">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Coaching error</p>
                        <p className="mt-0.5 text-red-600/80">{apiError}</p>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Bottom Typing / Dictation Bar */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-slate-50 space-y-3" id="chat-input-bar">
                  
                  {/* Speech transcript status helper banner */}
                  {isListening && (
                    <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 p-2.5 rounded-xl text-teal-800 text-xs">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-3 bg-teal-600 animate-pulse" />
                        <span className="w-1.5 h-3 bg-teal-600 animate-pulse" style={{ animationDelay: '200ms' }} />
                        <span className="w-1.5 h-3 bg-teal-600 animate-pulse" style={{ animationDelay: '400ms' }} />
                      </div>
                      <span className="font-semibold text-teal-700">Dictation listening active...</span>
                      <span className="text-[11px] text-slate-400 font-medium ml-auto">Simply speak clearly in English. Talk as long as you want!</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {/* Dictation Input mic trigger */}
                    <button
                      type="button"
                      onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                      className={`p-3 rounded-xl transition-all shadow-sm ${
                        isListening 
                          ? "bg-red-600 hover:bg-red-700 text-white animate-pulse" 
                          : "bg-teal-50 hover:bg-teal-100 text-teal-700"
                      }`}
                      title={isListening ? "Stop listening" : "Hands-free Speech Dictation"}
                      id="btn-voice-typing"
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-teal-600" />}
                    </button>

                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => {
                        setUserInput(e.target.value);
                        if (isListening) stopSpeechRecognition();
                      }}
                      placeholder="Type standard response sentence, or use speech dictation..."
                      className="flex-1 bg-white border border-slate-200 focus:border-teal-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-teal-500/10 text-slate-800 placeholder-slate-400 font-medium"
                      disabled={isCoachThinking}
                      id="input-chat-text"
                    />

                    <button
                      type="submit"
                      disabled={!userInput.trim() || isCoachThinking}
                      className={`p-3.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center text-white ${
                        userInput.trim() && !isCoachThinking
                          ? "bg-teal-600 hover:bg-teal-700 hover:translate-y-[-1px]"
                          : "bg-slate-300 pointer-events-none"
                      }`}
                      id="btn-send-utterance"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                    <span>Press Send or Speak clearly. Recommended: Keep speaking to practice your fluency metrics.</span>
                    <span className="font-semibold text-slate-500">Active Topic Discussion Engine</span>
                  </div>
                </form>

              </div>

              {/* Right Segment: Real-time Correction Hub & Fluency Radar (5 Cols) */}
              <div className="lg:col-span-5 h-full flex flex-col justify-start space-y-4" id="feedback-frame">
                
                {/* Score Contribution panel */}
                <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-3 relative overflow-hidden">
                  <div className="absolute top-[-15px] right-[-15px] w-24 h-24 bg-teal-500/10 rounded-full blur-xl" />
                  
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-200">Active Accourding Dashboard</h3>
                    <span className="flex items-center gap-1 text-xs text-amber-500 font-bold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <Flame className="w-3.5 h-3.5" />
                      Fluency Streak
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-1">
                    <div>
                      <span className="text-slate-400 text-[11px] font-medium block">Formulated Accuracy</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-extrabold text-teal-400 tracking-tight">{calculateFluencyPercentage()}%</span>
                        <span className="text-xs text-slate-500">score</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px] font-medium block">Total Words Spoken</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-extrabold text-teal-400 tracking-tight">{totalWordsSpoken}</span>
                        <span className="text-xs text-slate-500">words</span>
                      </div>
                    </div>
                  </div>

                  {/* Progressive visual tracker map */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                      <span>SESSION LENGTH (MINS)</span>
                      <span>{Math.round((elapsedSeconds/60)*10)/10}m completed</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(100, (elapsedSeconds / (sessionTargetMinutes * 60)) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Warning banner after passing min target */}
                  {elapsedSeconds >= 10 * 60 && (
                    <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-800/30 text-[11px] leading-relaxed text-teal-350">
                      🏅 **Excellent progress!** You have completed the 10-minute target sessions. Continue practicing or click &quot;End Session&quot; to inspect your Blueprint!
                    </div>
                  )}
                </div>

                {/* Real-time Dynamic Mistake Blueprint tracker list */}
                <div className="bg-white border border-slate-200 rounded-2xl flex-1 flex flex-col justify-between overflow-hidden shadow-sm">
                  
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-teal-600" />
                      Coach Avery&apos;s Corrections
                    </h3>
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wide text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-0.5">
                      {totalMistakesCount} errors logged
                    </span>
                  </div>

                  {/* Details view for checked bubble index errors */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[380px]" id="corrections-container">
                    
                    {activeFeedbackIndex !== null && messages[activeFeedbackIndex] && messages[activeFeedbackIndex].evaluation ? (
                      <div className="space-y-4" id="active-mistakes-details">
                        
                        {/* Brief General evaluation note */}
                        <div className="p-3 bg-teal-50/30 border border-teal-100/60 rounded-xl">
                          <p className="text-[11px] font-bold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5" />
                            Coach Assessment
                          </p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {messages[activeFeedbackIndex].evaluation?.generalComment}
                          </p>
                        </div>

                        {/* Mistakes listing cards */}
                        {messages[activeFeedbackIndex].evaluation?.hasMistakes ? (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-amber-700 flex items-center gap-1.5 uppercase tracking-wide">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Detected Sentence Mistakes
                            </h4>
                            
                            {messages[activeFeedbackIndex].evaluation?.mistakes.map((mistake) => (
                              <div key={mistake.id} className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/20 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                                    {mistake.category}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">Click Speak option for correct phrase below</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-slate-405 font-semibold text-slate-450 block">Your phrase:</span>
                                    <span className="font-medium text-red-655 line-through decoration-red-400 break-words text-red-700 block mt-0.5">{mistake.original}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-405 font-semibold text-slate-450 block">Correct formation:</span>
                                    <span className="font-semibold text-emerald-700 break-words block mt-0.5">{mistake.corrected}</span>
                                  </div>
                                </div>

                                <div className="border-t border-amber-100/50 pt-2 text-[11px] leading-relaxed text-slate-600">
                                  <p className="font-semibold text-slate-800">Why change it?</p>
                                  <p className="mt-0.5 text-slate-500">{mistake.explanation}</p>
                                </div>

                                <button 
                                  onClick={() => handleReadAloud(mistake.corrected)}
                                  className="text-[10px] font-bold text-teal-600 leading-normal flex items-center gap-1 hover:text-teal-700"
                                >
                                  <Volume2 className="w-3 h-3" />
                                  Hear Correct Version
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 text-center space-y-2">
                            <span className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mx-auto">
                              <ThumbsUp className="w-5 h-5" />
                            </span>
                            <h4 className="text-sm font-semibold text-emerald-800">Flawless Expression!</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              There are no corrections for this statement. Excellent sentence formation, formatting, and choice of dynamic phrasing!
                            </p>
                          </div>
                        )}

                        {/* Fluency tip booster card */}
                        {messages[activeFeedbackIndex].evaluation?.fluencyTip && (
                          <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/15 space-y-1.5">
                            <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              Fluency Booster Idea
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                              {messages[activeFeedbackIndex].evaluation?.fluencyTip}
                            </p>
                            <button 
                              onClick={() => handleReadAloud(messages[activeFeedbackIndex].evaluation?.fluencyTip || "")}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                            >
                              <Volume2 className="w-3 h-3" />
                              Hear Fluency Option
                            </button>
                          </div>
                        )}

                      </div>
                    ) : (
                      // Fallback panel if user has not entered anything yet
                      <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-3" id="blank-feedback-state">
                        <span className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <Activity className="w-6 h-6 text-slate-450 animate-pulse text-slate-500" />
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800">Awaiting user response</h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed mx-auto">
                            Submit a message on the chat flow. Avery will analyze your grammar structures instantly!
                          </p>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Navigation list of conversation history turns */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider mb-2 px-1">Conversation Turns Index</span>
                    <div className="flex gap-2 overflow-x-auto pb-1" id="scroller-msg-turns">
                      {messages.map((m, idx) => {
                        const isUserMsg = m.role === 'user';
                        // Look at the evaluation of NEXT message (assistant) for user sentence
                        const isEvaluatedNext = messages[idx+1]?.evaluation;
                        const hasErrors = isEvaluatedNext?.hasMistakes;

                        if (!isUserMsg) return null;

                        return (
                          <button
                            key={m.id}
                            onClick={() => messages[idx+1] && setActiveFeedbackIndex(idx + 1)}
                            className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                              activeFeedbackIndex === idx + 1 
                                ? 'bg-teal-600 border-teal-600 text-white font-bold ring-2 ring-teal-500/10' 
                                : hasErrors 
                                  ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' 
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>Turn #{Math.ceil((idx)/2)}</span>
                            {hasErrors && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>

            </motion.div>
          )}

          {/* STEP 3: MASTER PERFORMANCE BLUEPRINT & REPORT */}
          {appState === 'report' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6 max-w-4xl mx-auto py-4"
              id="report-blueprint-view"
            >
              
              {/* Cover Performance Card */}
              <div className="bg-slate-900 text-white p-6 md:p-8 rounded-2xl border border-slate-800 relative overflow-hidden shadow-lg space-y-6">
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-teal-500/15 rounded-full blur-3xl animate-pulse" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <span className="px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider">
                      English Coaching Report
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Your English Fluency Blueprint</h2>
                    <p className="text-slate-400 text-xs md:text-sm leading-relaxed max-w-lg">
                      Outstanding effort! This blueprint breakdowns your communication performance, grammar metrics, and next actionable steps to master confidence.
                    </p>
                  </div>

                  <div className="bg-teal-950/40 border border-teal-500/30 rounded-2xl p-4 text-center min-w-[140px]">
                    <span className="text-[10px] text-teal-300 font-bold block bg-teal-500/10 rounded-full px-2 py-0.5 uppercase tracking-widest mb-1">Fluency Ratio</span>
                    <span className="text-4xl font-black text-teal-400 tracking-tight">{calculateFluencyPercentage()}%</span>
                    <span className="text-[10px] text-slate-450 text-slate-400 block mt-1">Accuracy Grade</span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-slate-500 text-xs block">Duration Talked</span>
                    <span className="text-lg font-bold text-slate-200 block mt-1 font-mono">{formatTime(elapsedSeconds)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs block">Dialogue Sentences</span>
                    <span className="text-lg font-bold text-slate-200 block mt-1">{messages.filter(m => m.role === 'user').length}</span>
                  </div>
                  <div>
                    <span className="text-slate-505 text-slate-400 text-xs block">Vocabulary Words Spoken</span>
                    <span className="text-lg font-bold text-slate-200 block mt-1">{totalWordsSpoken} words</span>
                  </div>
                  <div>
                    <span className="text-slate-505 text-slate-400 text-xs block">Mistakes Corrected</span>
                    <span className="text-lg font-bold text-slate-200 block mt-1 text-teal-400">{totalMistakesCount} errors</span>
                  </div>
                </div>
              </div>

              {/* Main Blueprint Details split */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Mistakes Index Ledger (2/3 Cols) */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-505 text-slate-600" />
                      Detailed Sentence Correction Log
                    </h3>
                    
                    {allSessionMistakes.length > 0 ? (
                      <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                        {allSessionMistakes.map((mistake, idx) => (
                          <div 
                            key={idx} 
                            className="p-3.5 rounded-xl border border-slate-150 border-slate-200 bg-slate-50 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] uppercase font-bold font-mono tracking-wider">
                                {mistake.category} Correction #{idx+1}
                              </span>
                              
                              <button 
                                onClick={() => handleReadAloud(mistake.corrected)}
                                className="text-teal-650 hover:text-teal-700 font-bold flex items-center gap-0.5 text-[10px]"
                              >
                                <Volume2 className="w-3 h-3 text-teal-600" />
                                Listen Phrasing
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                              <div>
                                <span className="font-semibold text-slate-450 text-slate-500 block">Original construction:</span>
                                <span className="text-red-700 block mt-0.5 break-words line-through font-medium">{mistake.original}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-450 text-slate-500 block">Avery&apos;s recommended:</span>
                                <span className="text-emerald-700 font-semibold block mt-0.5 break-words">{mistake.corrected}</span>
                              </div>
                            </div>

                            <p className="text-[11px] leading-relaxed text-slate-600 border-t border-slate-200 pt-2 font-medium">
                              <span className="font-bold text-slate-750 text-slate-800">Underlying feedback: </span>
                              {mistake.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-3">
                        <span className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mx-auto">
                          <Award className="w-6 h-6" />
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-emerald-800">Unbelievable! Perfect Score Session</h4>
                          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mt-1">
                            You completed the entire conversation session without a single grammatical, structural, or lexical mistake! Your sentence layouts are pristine.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar containing Custom Vocabulary, general comments & Fluency Takeaways */}
                <div className="space-y-6">
                  
                  {/* Fluency Booster Bullet Checklist */}
                  <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Idiomatic Fluency Takeaways
                    </h3>

                    {fluencyTipsCollected.length > 0 ? (
                      <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                        {fluencyTipsCollected.slice(0, 5).map((tip, idx) => (
                          <div key={idx} className="flex gap-2.5 text-xs text-slate-600 leading-normal bg-indigo-50/10 p-2.5 rounded-lg border border-indigo-100/30">
                            <span className="w-5 h-5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center flex-shrink-0">
                              {idx+1}
                            </span>
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-800 leading-snug">{tip}</p>
                              <button 
                                onClick={() => handleReadAloud(tip)}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                              >
                                <Volume2 className="w-3 h-3 text-indigo-600" />
                                Listen Phrasing
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Keep carrying out conversational turns in active dialogue to collect alternative idioms.
                      </p>
                    )}
                  </div>

                  {/* Immediate study recommendation */}
                  <div className="bg-teal-50/40 border border-teal-100 p-6 rounded-2xl space-y-3.5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-teal-600" />
                      Your Custom Practice Plan
                    </h3>
                    <p className="text-xs text-slate-650 text-slate-700 leading-relaxed font-semibold">
                      Based on your communication session, we suggest focusing on standard English collocation rules. Re-practice using topics focusing on different verb tenses!
                    </p>
                    <button 
                      onClick={() => setAppState('setup')}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Start Another Session
                    </button>
                  </div>

                </div>

              </div>
              
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer Branding Credit */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-[11px] text-slate-400 font-medium tracking-wide flex flex-col md:flex-row items-center justify-between" id="app-footer">
        <div>
          <span>Powered securely with full-stack server-side Gemini 3.5 AI</span>
        </div>
        <div className="mt-1 md:mt-0 flex gap-4">
          <span>Target Practicing English Improvement Hub © 2026</span>
        </div>
      </footer>

    </div>
  );
}
