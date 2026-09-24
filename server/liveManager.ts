import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

export interface LiveQuestion {
  id: string | number;
  time: number;
  question: string;
  options: string[];
  correctAnswer: string;
  image?: string;
  explanation?: string;
}

export interface LiveStudent {
  id: string;
  name: string;
  sheetNumber: string;
  joinedAt: number;
  currentAnswer?: string | number | null;
  isCorrect?: boolean | null;
  answeredAt?: number;
  online: boolean;
  score: number;
  totalAnswered: number;
}

export interface QuestionStats {
  questionId: string | number;
  totalAnswered: number;
  totalCorrect: number;
  optionCounts: Record<number, number>; // index of option -> count
}

export interface LiveRoom {
  pin: string;
  teacherName: string;
  teacherPin?: string;
  lessonTitle: string;
  sheetNumber?: string;
  mediaUrl: string;
  mediaType: 'video' | 'audio';
  questions: LiveQuestion[];
  status: 'lobby' | 'playing' | 'paused' | 'question_active' | 'showing_results' | 'ended';
  currentTime: number;
  activeQuestion: LiveQuestion | null;
  activeQuestionStats: QuestionStats | null;
  students: Map<string, LiveStudent>;
  createdAt: number;
  lastActivityAt: number;
  attendanceHistory: Array<{
    id: string;
    name: string;
    sheetNumber: string;
    joinedAt: number;
    score: number;
    totalAnswered: number;
  }>;
}

interface SocketClientData {
  roomPin?: string;
  role?: 'teacher' | 'student';
  studentId?: string;
  isAlive: boolean;
}

export class LiveSessionManager {
  private rooms: Map<string, LiveRoom> = new Map();
  private clientData: Map<WebSocket, SocketClientData> = new Map();
  private wss: WebSocketServer | null = null;

  constructor() {
    // Clean up idle rooms every 15 minutes
    setInterval(() => {
      this.cleanupIdleRooms();
    }, 15 * 60 * 1000);
  }

  public init(wss: WebSocketServer) {
    this.wss = wss;

    // Heartbeat check every 30 seconds
    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        const data = this.clientData.get(ws);
        if (!data) return;
        if (data.isAlive === false) {
          this.handleDisconnect(ws);
          return ws.terminate();
        }
        data.isAlive = false;
        try {
          ws.ping();
        } catch (e) {
          // ignore
        }
      });
    }, 30000);

    wss.on('close', () => {
      clearInterval(interval);
    });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.clientData.set(ws, { isAlive: true });

      ws.on('pong', () => {
        const data = this.clientData.get(ws);
        if (data) data.isAlive = true;
      });

      ws.on('message', (message: string) => {
        try {
          const payload = JSON.parse(message.toString());
          this.handleMessage(ws, payload);
        } catch (err: any) {
          console.error('Error handling WS message:', err.message);
          this.sendToSocket(ws, {
            type: 'ERROR',
            message: 'صيغة الرسالة غير صالحة',
          });
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('WS client error:', err.message);
        this.handleDisconnect(ws);
      });
    });
  }

  private handleMessage(ws: WebSocket, msg: any) {
    const type = msg.type;
    const client = this.clientData.get(ws);
    if (!client) return;

    client.isAlive = true;

    switch (type) {
      // Teacher creates or re-attaches to a room
      case 'TEACHER_INIT_ROOM': {
        const {
          pin: requestedPin,
          teacherName,
          teacherPin,
          lessonTitle,
          sheetNumber,
          mediaUrl,
          mediaType,
          questions,
        } = msg.payload || {};

        let pin = requestedPin ? String(requestedPin).trim() : this.generateUniquePin();
        let room = this.rooms.get(pin);

        if (!room) {
          room = {
            pin,
            teacherName: teacherName || 'الأستاذ',
            teacherPin: teacherPin || '1234',
            lessonTitle: lessonTitle || 'درس تفاعلي',
            sheetNumber: sheetNumber || '',
            mediaUrl: mediaUrl || '',
            mediaType: mediaType === 'audio' ? 'audio' : 'video',
            questions: Array.isArray(questions) ? questions : [],
            status: 'lobby',
            currentTime: 0,
            activeQuestion: null,
            activeQuestionStats: null,
            students: new Map(),
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            attendanceHistory: [],
          };
          this.rooms.set(pin, room);
        } else {
          // Update room with newest lesson data
          room.teacherName = teacherName || room.teacherName;
          room.lessonTitle = lessonTitle || room.lessonTitle;
          room.mediaUrl = mediaUrl || room.mediaUrl;
          room.mediaType = mediaType || room.mediaType;
          if (Array.isArray(questions) && questions.length > 0) {
            room.questions = questions;
          }
          room.lastActivityAt = Date.now();
        }

        client.role = 'teacher';
        client.roomPin = pin;

        this.sendToSocket(ws, {
          type: 'ROOM_CREATED',
          payload: {
            room: this.serializeRoom(room, true),
          },
        });
        break;
      }

      // Student joins a room
      case 'STUDENT_JOIN': {
        const { pin: rawPin, studentName, sheetNumber } = msg.payload || {};
        const pin = String(rawPin || '').trim();
        const room = this.rooms.get(pin);

        if (!room) {
          this.sendToSocket(ws, {
            type: 'JOIN_ERROR',
            message: 'رمز الجلسة غير صحيح أو الجلسة غير نشطة حالياً. يرجى التأكد من الرمز.',
          });
          return;
        }

        const cleanName = String(studentName || '').trim() || 'طالب';
        const cleanSheetNumber = String(sheetNumber || '').trim();
        const studentId = `std_${cleanSheetNumber || 'guest'}_${cleanName.replace(/\s+/g, '_')}`;

        client.role = 'student';
        client.roomPin = pin;
        client.studentId = studentId;

        let student = room.students.get(studentId);
        if (!student) {
          student = {
            id: studentId,
            name: cleanName,
            sheetNumber: cleanSheetNumber,
            joinedAt: Date.now(),
            online: true,
            score: 0,
            totalAnswered: 0,
          };
          room.students.set(studentId, student);
          room.attendanceHistory.push({
            id: studentId,
            name: cleanName,
            sheetNumber: cleanSheetNumber,
            joinedAt: Date.now(),
            score: 0,
            totalAnswered: 0,
          });
        } else {
          student.online = true;
          student.name = cleanName;
        }

        room.lastActivityAt = Date.now();

        // Send confirmation to student
        this.sendToSocket(ws, {
          type: 'JOIN_SUCCESS',
          payload: {
            student,
            room: this.serializeRoom(room, false),
          },
        });

        // Broadcast updated student list to room (especially teacher)
        this.broadcastToRoom(pin, {
          type: 'STUDENT_LIST_UPDATED',
          payload: {
            students: Array.from(room.students.values()),
            onlineCount: Array.from(room.students.values()).filter((s) => s.online).length,
          },
        });
        break;
      }

      // Media status changes by teacher (Play / Pause / Time Update)
      case 'MEDIA_STATE_CHANGE': {
        if (client.role !== 'teacher' || !client.roomPin) return;
        const room = this.rooms.get(client.roomPin);
        if (!room) return;

        const { status, currentTime } = msg.payload || {};
        if (status) room.status = status;
        if (typeof currentTime === 'number') room.currentTime = currentTime;
        room.lastActivityAt = Date.now();

        // Broadcast to all students in room
        this.broadcastToRoom(
          room.pin,
          {
            type: 'MEDIA_STATE_CHANGED',
            payload: {
              status: room.status,
              currentTime: room.currentTime,
            },
          },
          ws
        );
        break;
      }

      // Trigger question by teacher (either automatically on timestamp or manually)
      case 'TRIGGER_QUESTION': {
        if (client.role !== 'teacher' || !client.roomPin) return;
        const room = this.rooms.get(client.roomPin);
        if (!room) return;

        const questionData: LiveQuestion = msg.payload?.question;
        if (!questionData) return;

        room.status = 'question_active';
        room.activeQuestion = questionData;
        room.lastActivityAt = Date.now();

        // Reset student answers for this new question
        room.students.forEach((s) => {
          s.currentAnswer = null;
          s.isCorrect = null;
          s.answeredAt = undefined;
        });

        // Prepare clean question payload for students (hide correct answer)
        const studentQuestionPayload = {
          id: questionData.id,
          time: questionData.time,
          question: questionData.question,
          options: questionData.options,
          image: questionData.image,
        };

        room.activeQuestionStats = {
          questionId: questionData.id,
          totalAnswered: 0,
          totalCorrect: 0,
          optionCounts: {},
        };

        // Notify teacher
        this.sendToSocket(ws, {
          type: 'QUESTION_ACTIVATED',
          payload: {
            question: questionData,
            stats: room.activeQuestionStats,
          },
        });

        // Notify all students in room
        this.broadcastToRoom(
          room.pin,
          {
            type: 'NEW_QUESTION',
            payload: {
              question: studentQuestionPayload,
            },
          },
          ws
        );
        break;
      }

      // Student submits an answer
      case 'SUBMIT_ANSWER': {
        if (client.role !== 'student' || !client.roomPin || !client.studentId) return;
        const room = this.rooms.get(client.roomPin);
        if (!room || !room.activeQuestion) return;

        const student = room.students.get(client.studentId);
        if (!student) return;

        const { questionId, selectedOption, selectedIndex } = msg.payload || {};
        if (String(room.activeQuestion.id) !== String(questionId)) return;

        // Determine if correct
        const correctAnswer = String(room.activeQuestion.correctAnswer || '').trim();
        const validOptions = (room.activeQuestion.options || []).map((o) => String(o ?? '').trim());

        let isCorrect = false;
        const numAnswer = parseInt(correctAnswer);
        if (!isNaN(numAnswer) && numAnswer >= 1 && numAnswer <= validOptions.length) {
          const correctOptionText = validOptions[numAnswer - 1];
          isCorrect =
            selectedIndex === numAnswer - 1 ||
            String(selectedOption).trim() === correctOptionText;
        } else {
          isCorrect = Boolean(
            String(selectedOption).trim().toLowerCase() === correctAnswer.toLowerCase() ||
            (typeof selectedIndex === 'number' &&
              validOptions[selectedIndex] &&
              validOptions[selectedIndex].toLowerCase() === correctAnswer.toLowerCase())
          );
        }

        student.currentAnswer = selectedOption;
        student.isCorrect = isCorrect;
        student.answeredAt = Date.now();
        student.totalAnswered += 1;
        if (isCorrect) student.score += 1;

        // Update activeQuestionStats
        if (room.activeQuestionStats) {
          room.activeQuestionStats.totalAnswered += 1;
          if (isCorrect) room.activeQuestionStats.totalCorrect += 1;
          const optIdx = typeof selectedIndex === 'number' ? selectedIndex : 0;
          room.activeQuestionStats.optionCounts[optIdx] =
            (room.activeQuestionStats.optionCounts[optIdx] || 0) + 1;
        }

        // Acknowledge to student
        this.sendToSocket(ws, {
          type: 'ANSWER_RECEIVED',
          payload: {
            questionId,
            selectedOption,
            selectedIndex,
          },
        });

        // Notify teacher of the new answer live
        this.sendToTeacher(room.pin, {
          type: 'STUDENT_ANSWERED',
          payload: {
            studentId: student.id,
            studentName: student.name,
            sheetNumber: student.sheetNumber,
            selectedOption,
            selectedIndex,
            isCorrect,
            stats: room.activeQuestionStats,
          },
        });
        break;
      }

      // Teacher reveals results to the classroom
      case 'REVEAL_RESULTS': {
        if (client.role !== 'teacher' || !client.roomPin) return;
        const room = this.rooms.get(client.roomPin);
        if (!room || !room.activeQuestion) return;

        room.status = 'showing_results';
        room.lastActivityAt = Date.now();

        // Calculate correct index
        const correctAnswer = String(room.activeQuestion.correctAnswer || '').trim();
        const validOptions = (room.activeQuestion.options || []).map((o) => String(o ?? '').trim());
        let correctIndex = -1;
        const numAnswer = parseInt(correctAnswer);
        if (!isNaN(numAnswer) && numAnswer >= 1 && numAnswer <= validOptions.length) {
          correctIndex = numAnswer - 1;
        } else {
          correctIndex = validOptions.findIndex(
            (o) => o.toLowerCase() === correctAnswer.toLowerCase()
          );
        }

        const resultsPayload = {
          questionId: room.activeQuestion.id,
          correctAnswer: room.activeQuestion.correctAnswer,
          correctIndex,
          explanation: room.activeQuestion.explanation || '',
          stats: room.activeQuestionStats,
        };

        // Broadcast results to everyone in room
        this.broadcastToRoom(room.pin, {
          type: 'RESULTS_REVEALED',
          payload: resultsPayload,
        });
        break;
      }

      // Teacher resumes media playback after question
      case 'RESUME_AFTER_QUESTION': {
        if (client.role !== 'teacher' || !client.roomPin) return;
        const room = this.rooms.get(client.roomPin);
        if (!room) return;

        room.status = 'playing';
        room.activeQuestion = null;
        room.activeQuestionStats = null;
        room.lastActivityAt = Date.now();

        this.broadcastToRoom(room.pin, {
          type: 'QUESTION_DISMISSED',
          payload: {
            status: 'playing',
            currentTime: room.currentTime,
          },
        });
        break;
      }

      // Teacher ends session
      case 'END_SESSION': {
        if (client.role !== 'teacher' || !client.roomPin) return;
        const room = this.rooms.get(client.roomPin);
        if (!room) return;

        room.status = 'ended';

        this.broadcastToRoom(room.pin, {
          type: 'SESSION_ENDED',
          payload: {
            message: 'انتهت الحصة التفاعلية. شكراً لاهتمامكم ومشاركتكم الرائعة!',
            summary: {
              lessonTitle: room.lessonTitle,
              attendanceCount: room.attendanceHistory.length,
            },
          },
        });
        break;
      }

      default:
        break;
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const client = this.clientData.get(ws);
    if (!client || !client.roomPin) {
      this.clientData.delete(ws);
      return;
    }

    const room = this.rooms.get(client.roomPin);
    if (room && client.role === 'student' && client.studentId) {
      const student = room.students.get(client.studentId);
      if (student) {
        student.online = false;
        // Notify room of student status update
        this.broadcastToRoom(room.pin, {
          type: 'STUDENT_LIST_UPDATED',
          payload: {
            students: Array.from(room.students.values()),
            onlineCount: Array.from(room.students.values()).filter((s) => s.online).length,
          },
        });
      }
    }

    this.clientData.delete(ws);
  }

  private sendToSocket(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (e) {
        // ignore send error
      }
    }
  }

  private broadcastToRoom(roomPin: string, data: any, excludeWs?: WebSocket) {
    this.clientData.forEach((client, ws) => {
      if (client.roomPin === roomPin && ws !== excludeWs) {
        this.sendToSocket(ws, data);
      }
    });
  }

  private sendToTeacher(roomPin: string, data: any) {
    this.clientData.forEach((client, ws) => {
      if (client.roomPin === roomPin && client.role === 'teacher') {
        this.sendToSocket(ws, data);
      }
    });
  }

  public getRoom(pin: string): LiveRoom | undefined {
    return this.rooms.get(pin);
  }

  public getAllActiveRooms(): any[] {
    return Array.from(this.rooms.values()).map((r) => ({
      pin: r.pin,
      teacherName: r.teacherName,
      lessonTitle: r.lessonTitle,
      status: r.status,
      onlineStudents: Array.from(r.students.values()).filter((s) => s.online).length,
      totalStudents: r.students.size,
      createdAt: r.createdAt,
    }));
  }

  private serializeRoom(room: LiveRoom, isTeacher: boolean) {
    return {
      pin: room.pin,
      teacherName: room.teacherName,
      lessonTitle: room.lessonTitle,
      sheetNumber: room.sheetNumber,
      mediaUrl: room.mediaUrl,
      mediaType: room.mediaType,
      status: room.status,
      currentTime: room.currentTime,
      activeQuestion: room.activeQuestion
        ? {
            id: room.activeQuestion.id,
            time: room.activeQuestion.time,
            question: room.activeQuestion.question,
            options: room.activeQuestion.options,
            image: room.activeQuestion.image,
            // Only teacher gets the correct answer initially
            ...(isTeacher ? { correctAnswer: room.activeQuestion.correctAnswer } : {}),
          }
        : null,
      activeQuestionStats: isTeacher ? room.activeQuestionStats : null,
      students: Array.from(room.students.values()),
      onlineCount: Array.from(room.students.values()).filter((s) => s.online).length,
    };
  }

  private generateUniquePin(): string {
    let pin = '';
    do {
      // 4-digit numeric PIN e.g. 4821
      pin = Math.floor(1000 + Math.random() * 9000).toString();
    } while (this.rooms.has(pin));
    return pin;
  }

  private cleanupIdleRooms() {
    const now = Date.now();
    const IDLE_LIMIT = 4 * 60 * 60 * 1000; // 4 hours
    this.rooms.forEach((room, pin) => {
      if (now - room.lastActivityAt > IDLE_LIMIT) {
        this.rooms.delete(pin);
      }
    });
  }
}

export const liveManager = new LiveSessionManager();
