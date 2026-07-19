import express from 'express';

const router = express.Router();
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'secret';

// 验证 secret
const checkSecret = (req, res, next) => {
  const secret = req.query.secret;
  if (secret !== BRIDGE_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  next();
};

// 全局命令队列
let commandQueue = [];

// GET /mcp — 返回可用工具列表
router.get('/', checkSecret, (req, res) => {
  res.json({
    tools: [
      {
        name: 'toy_status',
        description: '检查设备是否在线',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'toy_set_speed',
        description: '设置强度 (0-100%)',
        inputSchema: {
          type: 'object',
          properties: {
            speed: {
              type: 'number',
              description: '强度 0-100'
            }
          },
          required: ['speed']
        }
      },
      {
        name: 'toy_set_pattern',
        description: '设置振动花样 (1-8, 仅振动棒)',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'integer',
              description: '花样 1-8'
            },
            level: {
              type: 'number',
              description: '强度 1-100%'
            }
          },
          required: ['pattern', 'level']
        }
      },
      {
        name: 'toy_stop',
        description: '停止设备',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  });
});

// POST /mcp/call — 执行工具
router.post('/call', checkSecret, (req, res) => {
  const { tool, input } = req.body;
  
  let result = { ok: false, error: 'Unknown tool' };
  
  switch (tool) {
    case 'toy_status':
      result = {
        ok: true,
        online: true,
        message: '✅ 设备在线'
      };
      break;
    
    case 'toy_set_speed': {
      const speed = Math.max(0, Math.min(100, input.speed));
      const speedByte = Math.round((speed / 100) * 255);
      const cmd = [0x55, 0x04, 0x00, 0x00, 0x01, speedByte, 0xAA];
      commandQueue.push(cmd);
      result = {
        ok: true,
        speed,
        message: `强度设置为 ${speed}%`
      };
      break;
    }
    
    case 'toy_set_pattern': {
      const pattern = Math.max(1, Math.min(8, input.pattern));
      const level = Math.max(1, Math.min(5, Math.round((input.level / 100) * 5)));
      const cmd = [0x55, 0x03, 0x00, 0x00, pattern, level, 0x00];
      commandQueue.push(cmd);
      result = {
        ok: true,
        pattern,
        level,
        message: `花样 ${pattern} 已激活`
      };
      break;
    }
    
    case 'toy_stop': {
      const cmd = [0x55, 0x04, 0x00, 0x00, 0x00, 0x00, 0xAA];
      commandQueue.push(cmd);
      result = {
        ok: true,
        message: '设备已停止'
      };
      break;
    }
  }
  
  res.json(result);
});

// GET /mcp/queue — 获取下一个命令（给 bridge.py 用）
router.get('/queue', (req, res) => {
  const cmd = commandQueue.shift();
  res.json({ command: cmd || null });
});

export default router;
