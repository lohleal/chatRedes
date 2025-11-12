import express, { Application } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

class App {
  private app: Application;
  private http: http.Server;
  private io: Server;
  private messagesFile: string;
  private messagesData: Record<string, string[]>; // { sala: [msg1, msg2...] }

  constructor() {
    this.app = express();
    this.http = http.createServer(this.app);
    this.io = new Server(this.http);
    this.messagesFile = path.join(__dirname, 'messages.json');
    this.messagesData = this.loadMessages();
    this.listenSocket();
    this.setupRoutes();
  }

  listenServer() {
    const PORT = 3005;
    this.http.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Porta ${PORT} já está em uso. Feche o processo anterior.`);
        process.exit(1);
      }
    });
  }
  

  // 🔹 Lê as mensagens salvas
  loadMessages(): Record<string, string[]> {
    try {
      if (fs.existsSync(this.messagesFile)) {
        const data = fs.readFileSync(this.messagesFile, 'utf-8');
        return JSON.parse(data);
      } else {
        console.log('📁 Nenhum arquivo de mensagens encontrado. Criando um novo...');
        fs.writeFileSync(this.messagesFile, JSON.stringify({}, null, 2));
        return {};
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return {};
    }
  }
  

  // 🔹 Salva mensagens no arquivo
  saveMessages() {
    fs.writeFileSync(this.messagesFile, JSON.stringify(this.messagesData, null, 2));
  }

  listenSocket() {
    this.io.on('connection', (socket) => {
      console.log('Usuário conectado =>', socket.id);

      // Entrar em uma sala
      socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`${socket.id} entrou na sala: ${room}`);

        // Envia histórico da sala
        if (this.messagesData[room]) {
          socket.emit('loadMessages', this.messagesData[room]);
        }
      });

      // Receber mensagem
      socket.on('message', ({ room, msg }) => {
        console.log(`💬 [${room}] ${msg}`);

        // Salva em memória
        if (!this.messagesData[room]) this.messagesData[room] = [];
        this.messagesData[room].push(msg);

        // Atualiza o arquivo
        this.saveMessages();

        // Envia para os outros usuários da sala
        socket.to(room).emit('message', msg);
      });

      socket.on('disconnect', () => {
        console.log('Usuário desconectado =>', socket.id);
      });
    });
  }

  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '/index.html'));
    });
  }
}

const app = new App();
app.listenServer();
