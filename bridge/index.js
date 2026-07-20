import express from 'express';
import mcpRouter from './mcp.js';
import { commandQueue } from './queue.js';

const app = express();
app.use(express.json());

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'secret123';
const PORT = process.env.PORT || 3000;

// 中间件：验证 secret
const checkSecret = (req, res, next) => {
  const secret = req.headers['x-bridge-secret'] || req.query.secret;
  if (secret !== BRIDGE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// POST /command — 接收来自 PWA 或 Claude 的命令
app.post('/command', checkSecret, (req, res) => {
  const { command } = req.body;
  
  if (!command || !Array.isArray(command)) {
    return res.status(400).json({ error: 'Invalid command format' });
  }
  
  commandQueue.push(command);
  console.log(`📥 收到命令: ${command.join(',')}, 队列长度: ${commandQueue.length}`);
  
  res.json({ ok: true, queued: commandQueue.length });
});

// GET /poll — bridge.py 轮询获取命令
app.get('/poll', checkSecret, (req, res) => {
  const command = commandQueue.shift();
  
  if (command) {
    console.log(`📤 发送命令: ${command.join(',')}`);
  }
  
  res.json({ command: command || null });
});

// GET /status — 检查服务器是否在线
app.get('/status', (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    queueLength: commandQueue.length
  });
});

// 添加 MCP 路由
app.use('/mcp', mcpRouter);

app.listen(PORT, () => {
  console.log(`🚀 Bridge 服务器启动`);
  console.log(`   端口: ${PORT}`);
  console.log(`   Secret: ${BRIDGE_SECRET}`);
  console.log(`   访问: http://localhost:${PORT}/status`);
});
