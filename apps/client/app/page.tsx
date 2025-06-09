"use client"

import * as React from "react"
import { useEffect, useState, ChangeEvent, FormEvent, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { MessageCircleIcon, Loader2, Copy } from "lucide-react";
import { toast } from "sonner"

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender:string;
  timestamp: Date;
}

/* eslint-disable no-unused-vars */
interface ServerToClientEvents {
  'room-created': (code: string) => void;
  'joined-room': (data: { roomCode: string; messages: Message[] }) => void;
  'new-message': (message: Message) => void;
  'user-joined': (userCount: number) => void;
  'user-left': (userCount: number) => void;
  error: (message: string) => void;
}

interface ClientToServerEvents {
  'create-room': () => void;
  'join-room': (roomCode: string) => void;
  'send-message': (data: { roomCode: string; message: string; userId: string , name:string}) => void;
  'set-user-id': (userId: string) => void;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://rtc-chat-free.onrender.com';
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL);

const MessageGroup = ({ messages, userId }: { messages: Message[], userId: string }) => {
  return (
    <>
      {messages.map((msg, index) => {
        const isFirstInGroup = index === 0 || messages[index - 1]?.senderId !== msg.senderId;
        
        return (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.senderId === userId ? 'items-end' : 'items-start'
            }`}
          >
            {isFirstInGroup && (
              <div className="text-xs text-muted-foreground mb-0.5">
                {msg.sender}
              </div>
            )}
            <div
              className={`inline-block rounded-lg px-3 py-1.5 break-words ${
                msg.senderId === userId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              } ${!isFirstInGroup ? 'mt-0.5' : 'mt-1.5'}`}
            >
              {msg.content}
            </div>
          </div>
        );
      })}
    </>
  );
};

export default function Page() {
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [name, setName] = useState<string>("")
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [users, setUsers] = useState<number>(0);
  const [userId, setUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const storedUserId = localStorage.getItem('chatUserId');
    const newUserId = storedUserId || crypto.randomUUID();
    
    if (!storedUserId) {
      localStorage.setItem('chatUserId', newUserId);
    }
    
    setUserId(newUserId);

    socket.emit('set-user-id', newUserId);
  }, []);

  useEffect(() => {
    socket.on('room-created', (code) => {
      setRoomCode(code);
      setIsLoading(false);
      toast.success('Room created successfully!');
    });

    socket.on('joined-room', ({ roomCode, messages }) => {
      setRoomCode(roomCode);
      setMessages(messages);
      setConnected(true);
      setInputCode('');
      toast.success('Joined room successfully!');
    });

    socket.on('new-message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('user-joined', (userCount) => {
      setUsers(userCount);
      toast.info('A user has joined the room');
    });

    socket.on('user-left', (userCount) => {
      setUsers(userCount);
      toast.info('A user has left the room');
    });

    socket.on('error', (error) => {
      toast.error(error);
      setIsLoading(false);
      if (error === 'Room not found' || error === 'Room is full') {
        setInputCode('');
      }
    });

    return () => {
      socket.off('room-created');
      socket.off('joined-room');
      socket.off('new-message');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('error');
    };
  }, []);

  const createRoom = () => {
    setIsLoading(true);
    socket.emit('create-room');
  };

  const joinRoom = () => {
    if (!inputCode.trim()) {
      toast.error('Please enter a room code');
      return;
    }
    
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    socket.emit('join-room', JSON.stringify({roomId:inputCode.toUpperCase(),name}));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputCode(e.target.value);
  };
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleMessageChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  const sendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('send-message', { roomCode, message, userId,name });
      setMessage('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]).then(() => {
      toast.success('Room code copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy room code');
    });
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="container mx-auto max-w-2xl p-4 h-screen flex items-center justify-center">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl flex items-center gap-2 font-bold">
              <MessageCircleIcon className="w-6 h-6" />
              Real Time Chat
            </CardTitle>
            <CardDescription>
              temporary room that expires after all users exit
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!connected ? (
              <div className="space-y-4">
                <Button 
                  onClick={createRoom} 
                  className="w-full text-lg py-6"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating room...
                    </>
                  ) : (
                    "Create New Room"
                  )}
                </Button>
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Enter your name"
                    className="text-lg py-5"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={inputCode}
                    onChange={handleInputChange}
                    placeholder="Enter Room Code"
                    className="text-lg py-5"
                  />
                  <Button 
                    onClick={joinRoom}
                    size="lg"
                    className="px-8"
                  >
                    Join Room
                  </Button>
                </div>
   
                {roomCode && (
                  <div className="text-center p-6 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Share this code with your friend</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-2xl font-bold">{roomCode}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(roomCode)}
                        className="h-8 w-8"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-7">
                <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span>Room Code: <span className="font-mono font-bold">{roomCode}</span></span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(roomCode)}
                      className="h-6 w-6"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <span>Users: {users}</span>
                </div>

                <div className="h-[430px] overflow-y-auto border rounded-lg p-4 space-y-2">
                  <MessageGroup messages={messages} userId={userId} />
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type a message..."
                    className="text-lg py-5"
                  />
                  <Button 
                    type="submit"
                    size="lg"
                    className="px-8"
                  >
                    Send
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
