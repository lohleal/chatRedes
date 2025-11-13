import express, { Application } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

//definr o formato da mensagem
interface Message {
  username: string;
  msg: string;
}

class App {
  private app: Application;
  private http: http.Server;
  private io: Server;
  private messagesFile: string;
  private messagesData: Record<string, Message[]>; 

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

  // Lê as mensagens salvas
  loadMessages(): Record<string, Message[]> {
    try {
      if (fs.existsSync(this.messagesFile)) {
        const data = fs.readFileSync(this.messagesFile, 'utf-8');
        return JSON.parse(data);
      } else {
        console.log('Nenhum arquivo de mensagens encontrado. Criando um novo...');
        fs.writeFileSync(this.messagesFile, JSON.stringify({}, null, 2));
        return {};
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return {};
    }
  }

  // Salva mensagens no arquivo
  saveMessages() {
    fs.writeFileSync(this.messagesFile, JSON.stringify(this.messagesData, null, 2));
  }

  listenSocket() {
    this.io.on('connection', (socket) => {
      console.log('Usuário conectado =>', socket.id);

      // Entrar em uma sala com nome de usuario
      socket.on('joinRoom', (room: string, username: string) => {
        socket.join(room);
        (socket as any).username = username; // salva o nome no socket
        console.log(`${username} entrou na sala: ${room}`);

        // Envia histórico da sala
        if (this.messagesData[room]) {
          socket.emit('loadMessages', this.messagesData[room]);
        }
      });

      //Receber mensagem
      socket.on('message', ({ room, username, msg }) => {
        console.log(`[${room}] ${username}: ${msg}`);

        const newMsg = { username, msg };

        // Salva em memória
        if (!this.messagesData[room]) this.messagesData[room] = [];
        this.messagesData[room].push(newMsg);

        // Atualiza o arquivo
        this.saveMessages();

        // Envia para todos os usuários da sala
        this.io.to(room).emit('message', newMsg);
      });

      // Desconectar
      socket.on('disconnect', () => {
        const username = (socket as any).username || socket.id;
        console.log(`${username} saiu do chat`);
      });
    });
  }

  setupRoutes() {
    this.app.use(express.static(path.join(__dirname))); 
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '/index.html'));
    });
  }
}

const app = new App();
app.listenServer();
