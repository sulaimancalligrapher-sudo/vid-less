import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ==========================================
  // --- IN-MEMORY REALTIME LIVE CLASS STATE ---
  // ==========================================
  interface LiveQuestionPayload {
    index: number;
    time: number;
    timeFormatted?: string;
    question: string;
    options: string[];
    isTextAnswer?: boolean;
    correctAnswer: string;
    image?: string;
  }

  interface LiveConnectedStudent {
    username: string;
    sheetNumber: string;
    joinedAt: number;
    lastPing: number;
    pinVerified?: boolean;
  }

  interface LiveStudentAnswerSubmission {
    username: string;
    sheetNumber: string;
    answer: string;
    isCorrect?: boolean | null;
    submittedAt: number;
  }

  function generatePinCode(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  let currentLiveSession = {
    sessionId: 'live-main',
    sessionPin: '1234',
    lessonTitle: '',
    videoUrl: '',
    status: 'idle' as 'idle' | 'waiting' | 'playing' | 'question_active' | 'revealed' | 'finished',
    currentQuestionIndex: null as number | null,
    currentQuestion: null as LiveQuestionPayload | null,
    questionTriggeredAt: null as number | null,
    timeLimit: 30,
    showResult: 'نعم' as 'نعم' | 'لا',
    connectedStudents: [] as LiveConnectedStudent[],
    answersForCurrentQuestion: {} as Record<string, LiveStudentAnswerSubmission>,
    allSessionAnswers: {} as Record<string, Record<number, string>>,
  };

  const sseClients = new Set<express.Response>();

  function broadcastLiveState() {
    const payload = JSON.stringify(currentLiveSession);
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }

  // SSE Stream for Real-time Instant Updates (<0.1s latency)
  app.get("/api/live/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Send immediate current state
    res.write(`data: ${JSON.stringify(currentLiveSession)}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Get current state (REST fallback)
  app.get("/api/live/state", (req, res) => {
    res.json(currentLiveSession);
  });

  // Teacher initializes or changes lesson
  app.post("/api/live/init", (req, res) => {
    const { lessonTitle, videoUrl, timeLimit, showResult, sessionPin } = req.body;
    currentLiveSession.sessionId = 'live-' + Date.now();
    currentLiveSession.sessionPin = sessionPin && String(sessionPin).trim() ? String(sessionPin).trim() : generatePinCode();
    currentLiveSession.lessonTitle = lessonTitle || 'درس تفاعلي مباشر';
    currentLiveSession.videoUrl = videoUrl || '';
    currentLiveSession.status = 'waiting';
    currentLiveSession.currentQuestionIndex = null;
    currentLiveSession.currentQuestion = null;
    currentLiveSession.questionTriggeredAt = null;
    currentLiveSession.timeLimit = typeof timeLimit === 'number' && timeLimit > 0 ? timeLimit : 30;
    currentLiveSession.showResult = showResult || 'نعم';
    currentLiveSession.answersForCurrentQuestion = {};
    // keep connected students or reset answers
    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Teacher changes or regenerates PIN
  app.post("/api/live/update-pin", (req, res) => {
    const { pin } = req.body;
    currentLiveSession.sessionPin = pin && String(pin).trim() ? String(pin).trim() : generatePinCode();
    broadcastLiveState();
    res.json({ success: true, pin: currentLiveSession.sessionPin, state: currentLiveSession });
  });

  // Student joins room with PIN check
  app.post("/api/live/join", (req, res) => {
    const { username, sheetNumber, pin } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'اسم الطالب مطلوب' });
    }

    const enteredPin = String(pin || '').trim();
    const activePin = String(currentLiveSession.sessionPin || '').trim();

    // Check PIN if session requires it
    if (activePin && enteredPin !== activePin) {
      return res.status(401).json({ 
        success: false, 
        error: 'رقم تسجيل حضور الحصة غير صحيح! تأكد من الرقم المعروض على شاشة العرض.' 
      });
    }

    const cleanUser = String(username).trim();
    const cleanSheet = String(sheetNumber || '').trim();

    // Check if student already in list
    const existingIdx = currentLiveSession.connectedStudents.findIndex(
      s => s.username === cleanUser && s.sheetNumber === cleanSheet
    );

    const now = Date.now();
    if (existingIdx >= 0) {
      currentLiveSession.connectedStudents[existingIdx].lastPing = now;
      currentLiveSession.connectedStudents[existingIdx].pinVerified = true;
    } else {
      currentLiveSession.connectedStudents.push({
        username: cleanUser,
        sheetNumber: cleanSheet,
        joinedAt: now,
        lastPing: now,
        pinVerified: true,
      });
    }

    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Student heartbeat ping
  app.post("/api/live/ping", (req, res) => {
    const { username, sheetNumber } = req.body;
    if (username) {
      const cleanUser = String(username).trim();
      const cleanSheet = String(sheetNumber || '').trim();
      const existing = currentLiveSession.connectedStudents.find(
        s => s.username === cleanUser && s.sheetNumber === cleanSheet
      );
      if (existing) {
        existing.lastPing = Date.now();
      }
    }
    res.json({ success: true });
  });

  // Student leaves or closes room
  app.post("/api/live/leave", (req, res) => {
    const { username, sheetNumber } = req.body;
    if (username) {
      const cleanUser = String(username).trim();
      const cleanSheet = String(sheetNumber || '').trim();
      const initialLen = currentLiveSession.connectedStudents.length;
      currentLiveSession.connectedStudents = currentLiveSession.connectedStudents.filter(
        s => !(s.username === cleanUser && s.sheetNumber === cleanSheet)
      );
      if (currentLiveSession.connectedStudents.length !== initialLen) {
        broadcastLiveState();
      }
    }
    res.json({ success: true, state: currentLiveSession });
  });

  // Regular cleanup of disconnected / closed student sessions (if no ping for 15s)
  setInterval(() => {
    const now = Date.now();
    const activeThreshold = 15000; // 15 seconds
    const initialLen = currentLiveSession.connectedStudents.length;
    currentLiveSession.connectedStudents = currentLiveSession.connectedStudents.filter(s => {
      return (now - (s.lastPing || 0)) < activeThreshold;
    });
    if (currentLiveSession.connectedStudents.length !== initialLen) {
      broadcastLiveState();
    }
  }, 4000);

  // Teacher / Video triggers a question!
  app.post("/api/live/trigger-question", (req, res) => {
    const { questionIndex, question, timeLimit, showResult } = req.body;
    currentLiveSession.status = 'question_active';
    currentLiveSession.currentQuestionIndex = questionIndex;
    currentLiveSession.currentQuestion = question;
    currentLiveSession.questionTriggeredAt = Date.now();
    if (timeLimit) currentLiveSession.timeLimit = Number(timeLimit);
    if (showResult) currentLiveSession.showResult = showResult;
    currentLiveSession.answersForCurrentQuestion = {}; // Reset answers for this new question

    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Student submits an answer
  app.post("/api/live/submit-answer", (req, res) => {
    const { username, sheetNumber, answer, questionIndex, isCorrect } = req.body;
    if (!username || answer === undefined) {
      return res.status(400).json({ success: false, error: 'بيانات غير مكتملة' });
    }

    const cleanUser = String(username).trim();
    const cleanSheet = String(sheetNumber || '').trim();
    const studentKey = `${cleanUser}_${cleanSheet}`;

    currentLiveSession.answersForCurrentQuestion[studentKey] = {
      username: cleanUser,
      sheetNumber: cleanSheet,
      answer: String(answer),
      isCorrect: isCorrect,
      submittedAt: Date.now(),
    };

    // Also store in allSessionAnswers
    const qIdx = questionIndex !== undefined ? Number(questionIndex) : (currentLiveSession.currentQuestionIndex ?? 0);
    if (!currentLiveSession.allSessionAnswers[studentKey]) {
      currentLiveSession.allSessionAnswers[studentKey] = {};
    }
    currentLiveSession.allSessionAnswers[studentKey][qIdx] = String(answer);

    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Teacher reveals correct answer
  app.post("/api/live/reveal-answer", (req, res) => {
    currentLiveSession.status = 'revealed';
    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Teacher resumes video
  app.post("/api/live/resume", (req, res) => {
    currentLiveSession.status = 'playing';
    currentLiveSession.currentQuestion = null;
    currentLiveSession.currentQuestionIndex = null;
    currentLiveSession.questionTriggeredAt = null;
    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Teacher finishes session
  app.post("/api/live/finish", (req, res) => {
    currentLiveSession.status = 'finished';
    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Reset session
  app.post("/api/live/reset", (req, res) => {
    currentLiveSession = {
      sessionId: 'live-' + Date.now(),
      sessionPin: generatePinCode(),
      lessonTitle: '',
      videoUrl: '',
      status: 'idle',
      currentQuestionIndex: null,
      currentQuestion: null,
      questionTriggeredAt: null,
      timeLimit: 30,
      showResult: 'نعم',
      connectedStudents: [],
      answersForCurrentQuestion: {},
      allSessionAnswers: {},
    };
    broadcastLiveState();
    res.json({ success: true, state: currentLiveSession });
  });

  // Google Drive Streaming Proxy Route with Auto Virus Warning Bypass
  app.get("/api/proxy-drive", async (req, res) => {
    const driveId = req.query.id as string;
    if (!driveId) {
      return res.status(400).send("Missing id parameter");
    }

    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      let targetUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
      let response: Response;

      // Manual redirect follower loop (max 5 redirects) to ensure headers (like Range) are preserved
      let redirectCount = 0;
      while (true) {
        response = await fetch(targetUrl, {
          headers,
          redirect: 'manual'
        });

        if (
          response.status === 301 ||
          response.status === 302 ||
          response.status === 303 ||
          response.status === 307 ||
          response.status === 308
        ) {
          const redirectUrl = response.headers.get('location');
          if (redirectUrl && redirectCount < 5) {
            if (redirectUrl.startsWith('/')) {
              const urlObj = new URL(targetUrl);
              targetUrl = `${urlObj.origin}${redirectUrl}`;
            } else {
              targetUrl = redirectUrl;
            }
            redirectCount++;
            continue;
          }
        }
        break;
      }

      const contentType = response.headers.get('content-type') || '';
      
      // If Google Drive returns HTML, it means a virus confirmation page is shown!
      if (contentType.includes('text/html')) {
        const html = await response.text();
        
        // Match token e.g. confirm=xxxx
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        
        if (confirmMatch && confirmMatch[1]) {
          const confirmToken = confirmMatch[1];
          let confirmedUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=${confirmToken}`;

          let confirmResponse: Response;
          let confirmRedirectCount = 0;
          while (true) {
            confirmResponse = await fetch(confirmedUrl, {
              headers,
              redirect: 'manual'
            });

            if (
              confirmResponse.status === 301 ||
              confirmResponse.status === 302 ||
              confirmResponse.status === 303 ||
              confirmResponse.status === 307 ||
              confirmResponse.status === 308
            ) {
              const redirectUrl = confirmResponse.headers.get('location');
              if (redirectUrl && confirmRedirectCount < 5) {
                if (redirectUrl.startsWith('/')) {
                  const urlObj = new URL(confirmedUrl);
                  confirmedUrl = `${urlObj.origin}${redirectUrl}`;
                } else {
                  confirmedUrl = redirectUrl;
                }
                confirmRedirectCount++;
                continue;
              }
            }
            break;
          }

          // Forward headers
          const sContentType = confirmResponse.headers.get('content-type');
          const sContentLength = confirmResponse.headers.get('content-length');
          const sContentRange = confirmResponse.headers.get('content-range');
          const sAcceptRanges = confirmResponse.headers.get('accept-ranges');

          if (sContentType) res.setHeader('content-type', sContentType);
          if (sContentLength) res.setHeader('content-length', sContentLength);
          if (sContentRange) res.setHeader('content-range', sContentRange);
          if (sAcceptRanges) res.setHeader('accept-ranges', sAcceptRanges);

          res.status(confirmResponse.status);
          if (confirmResponse.body) {
            Readable.fromWeb(confirmResponse.body as any).pipe(res);
          } else {
            res.end();
          }
          return;
        }
      }

      // Direct download worked (no virus confirmation screen)
      const fContentType = response.headers.get('content-type');
      const fContentLength = response.headers.get('content-length');
      const fContentRange = response.headers.get('content-range');
      const fAcceptRanges = response.headers.get('accept-ranges');

      if (fContentType) res.setHeader('content-type', fContentType);
      if (fContentLength) res.setHeader('content-length', fContentLength);
      if (fContentRange) res.setHeader('content-range', fContentRange);
      if (fAcceptRanges) res.setHeader('accept-ranges', fAcceptRanges);

      res.status(response.status);
      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }

    } catch (error: any) {
      console.error("Error in proxy-drive server endpoint:", error.message);
      res.status(500).send("Error proxying video/audio from Google Drive");
    }
  });

  // Vite development middleware vs production static server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
