const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

// Enhanced request logger with colored output
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method.padEnd(6);
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Log the incoming request
  console.log(`📥 ${timestamp} | ${method} | ${ip} → ${url}`);
  
  // Capture original end function to log response
  const originalEnd = res.end;
  const startTime = Date.now();
  
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    let statusIcon = '✅';
    
    if (status >= 400 && status < 500) {
      statusIcon = '⚠️ ';
    } else if (status >= 500) {
      statusIcon = '❌';
    } else if (status >= 300 && status < 400) {
      statusIcon = '🔀';
    }
    
    console.log(`📤 ${timestamp} | ${method} | ${status} ${statusIcon} | ${duration}ms | ${url}`);
    
    // Call original end function
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

// Serve static files from public directory
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Middleware to parse JSON bodies
app.use(express.json({ limit: '100mb' }));

// Ensure data directory exists for storing persistent JSON (filters etc.)
const dataDir = path.join(__dirname, 'data');
try{
  if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}catch(e){ console.warn('Could not create data directory:', e && e.message); }

const filtersPath = path.join(dataDir, 'filters.json');
// ensure filters file exists
try{
  if(!fs.existsSync(filtersPath)) fs.writeFileSync(filtersPath, JSON.stringify({ rules: [] }, null, 2), 'utf8');
}catch(e){ console.warn('Could not create filters.json:', e && e.message); }

// API: get all saved filters
app.get('/api/filters', (req, res) => {
  fs.readFile(filtersPath, 'utf8', (err, raw) => {
    if(err){
      console.error('Error reading filters.json', err.message);
      return res.status(500).json({ success:false, error: err.message });
    }
    try{
      const j = JSON.parse(raw || '{}');
      return res.json({ success:true, data: j });
    }catch(e){
      return res.status(500).json({ success:false, error: 'Invalid JSON in filters store' });
    }
  });
});

// API: list data files (xlsx, xls, csv) under public/data
app.get('/api/data-files', (req, res) => {
  const dataDirPublic = path.join(publicDir, 'data');
  try{
    if(!fs.existsSync(dataDirPublic)) return res.json({ success:true, files: [] });
    const items = fs.readdirSync(dataDirPublic).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.xlsx', '.xls', '.csv', '.xlsm'].includes(ext);
    }).map(f => ({ name: f, webPath: '/data/' + f }));
    return res.json({ success:true, files: items });
  }catch(e){
    console.error('Error listing data files', e && e.message);
    return res.status(500).json({ success:false, error: e && e.message });
  }
});

// API: upload a workbook into public/data (expects JSON { filename, contentBase64 })
app.post('/api/upload-data', (req, res) => {
  try{
    const payload = req.body || {};
    let filename = String(payload.filename || '').trim();
    const contentBase64 = String(payload.contentBase64 || '');
    if(!filename || !contentBase64) return res.status(400).json({ success:false, error: 'Missing filename or contentBase64' });
    // sanitize filename
    filename = filename.replace(/^[\\/]+/, '');
    filename = path.basename(filename);
    const safe = path.normalize(filename);
    if(safe.includes('..')) return res.status(400).json({ success:false, error: 'Invalid filename' });
    const destDir = path.join(publicDir, 'data');
    if(!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, safe);
    const buf = Buffer.from(contentBase64, 'base64');
    fs.writeFile(dest, buf, (err)=>{
      if(err){ console.error('upload-data write error', err && err.message); return res.status(500).json({ success:false, error: err.message }); }
      return res.json({ success:true, filename: safe, webPath: '/data/' + safe, bytes: buf.length });
    });
  }catch(e){ console.error('upload-data error', e && e.message); return res.status(500).json({ success:false, error: e && e.message }); }
});

// API: replace the filters.json content (save all)
app.post('/api/filters', (req, res) => {
  const payload = req.body || {};
  fs.writeFile(filtersPath, JSON.stringify(payload, null, 2), 'utf8', (err) => {
    if(err){
      console.error('Error writing filters.json', err.message);
      return res.status(500).json({ success:false, error: err.message });
    }
    return res.json({ success:true, data: payload });
  });
});

// API: delete a filter by id (assumes filters stored as { rules: [...] })
app.delete('/api/filters/:id', (req, res) => {
  const id = req.params.id;
  fs.readFile(filtersPath, 'utf8', (err, raw) => {
    if(err) return res.status(500).json({ success:false, error: err.message });
    let store = { rules: [] };
    try{ store = JSON.parse(raw||'{}'); }catch(e){ /* ignore */ }
    if(!Array.isArray(store.rules)) store.rules = [];
    const before = store.rules.length;
    store.rules = store.rules.filter(r => String(r._id || r.id || r.id_str || '') !== String(id));
    const after = store.rules.length;
    fs.writeFile(filtersPath, JSON.stringify(store, null, 2), 'utf8', (werr) => {
      if(werr) return res.status(500).json({ success:false, error: werr.message });
      return res.json({ success:true, removed: before - after, data: store });
    });
  });
});

// Endpoint to save master.json
app.post('/save-master-json', (req, res) => {
  const timestamp = new Date().toISOString();
  const jsonData = req.body;
  const filePath = path.join(publicDir, 'master.json');
  
  console.log(`💾 ${timestamp} | Saving master.json (${JSON.stringify(jsonData).length} bytes)`);
  
  fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error(`❌ ${timestamp} | Failed to save master.json:`, err.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to save master.json',
        details: err.message,
        timestamp: timestamp
      });
    }
    console.log(`✅ ${timestamp} | Successfully saved master.json to ${filePath}`);
    res.json({ 
      success: true, 
      message: 'master.json saved successfully',
      filePath: filePath,
      timestamp: timestamp
    });
  });
});

// Endpoint to save an uploaded workbook (base64) to a file under public directory
app.post('/save-workbook', (req, res) => {
  try{
    const payload = req.body || {};
    const relPath = String(payload.path || '').trim();
    const contentBase64 = String(payload.contentBase64 || '');
    if(!relPath || !contentBase64) return res.status(400).json({ success:false, error: 'Missing path or contentBase64' });

    // sanitize path to avoid traversal - allow paths relative to publicDir
    let safeRel = relPath.replace(/^[\\/]+/, ''); // strip leading slashes
    safeRel = path.normalize(safeRel);
    if(safeRel.includes('..')) return res.status(400).json({ success:false, error: 'Invalid path' });

    const dest = path.join(publicDir, safeRel);
    if(!dest.startsWith(publicDir)) return res.status(400).json({ success:false, error: 'Path must be inside public directory' });

    const buf = Buffer.from(contentBase64, 'base64');
    fs.writeFile(dest, buf, (err)=>{
      if(err){
        console.error('Failed to write workbook', err && err.message);
        return res.status(500).json({ success:false, error: 'Failed to write file', details: err.message });
      }
      console.log(`✅ Saved workbook to ${dest} (${buf.length} bytes)`);
      return res.json({ success:true, path: safeRel, bytes: buf.length });
    });
  }catch(e){
    console.error('save-workbook error', e && e.message);
    return res.status(500).json({ success:false, error: e && e.message });
  }
});

// List all files in the public directory (for debugging)
app.get('/list-files', (req, res) => {
  const listFiles = (dir, baseDir = '') => {
    const items = fs.readdirSync(dir);
    return items.map(item => {
      const fullPath = path.join(dir, item);
      const relativePath = path.join(baseDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        return {
          name: item,
          path: relativePath.replace(/\\/g, '/'),
          type: 'directory',
          children: listFiles(fullPath, relativePath)
        };
      } else {
        return {
          name: item,
          path: relativePath.replace(/\\/g, '/'),
          type: 'file',
          size: stat.size
        };
      }
    });
  };

  try {
    const files = listFiles(publicDir);
    res.json({ success: true, files });
  } catch (error) {
    console.error('❌ Error listing files:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 Handler for non-existent routes
app.use((req, res) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  console.log(`🚫 ${timestamp} | 404 NOT FOUND | ${method} ${url} from ${ip}`);
  console.log(`💡 Available routes: /, /save-master-json, /list-files, /public/*`);
  
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `The requested URL '${url}' was not found on this server.`,
    availableRoutes: [
      'GET / (serves index.html if exists)',
      'POST /save-master-json',
      'GET /list-files',
      'GET /public/* (static files)'
    ],
    timestamp: timestamp
  });
});

// Global error handler
app.use((error, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`💥 ${timestamp} | SERVER ERROR:`, error.message);
  console.error('Stack trace:', error.stack);
  
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'Something went wrong on the server.',
    timestamp: timestamp
  });
});

// Function to kill processes on port 3000
const killProcessesOnPort = (port) => {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows: Find and kill processes on port
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          console.log(`✓ No processes found running on port ${port}`);
          return resolve();
        }

        const lines = stdout.split('\n').filter(line => line.includes(':' + port));
        const pids = [...new Set(lines.map(line => {
          const parts = line.trim().split(/\s+/);
          return parts[parts.length - 1];
        }).filter(pid => pid && pid !== '0'))];

        if (pids.length === 0) {
          console.log(`✓ No processes found running on port ${port}`);
          return resolve();
        }

        console.log(`🔄 Found ${pids.length} process(es) on port ${port}, killing PIDs: ${pids.join(', ')}`);
        
        let killedCount = 0;
        pids.forEach(pid => {
          exec(`taskkill /F /PID ${pid}`, (killError) => {
            killedCount++;
            if (killError) {
              console.log(`⚠️  Could not kill PID ${pid}: ${killError.message}`);
            } else {
              console.log(`✓ Killed process PID ${pid}`);
            }
            
            if (killedCount === pids.length) {
              setTimeout(() => resolve(), 1000); // Wait 1s after killing
            }
          });
        });
      });
    } else {
      // Unix/Linux/Mac
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error || !stdout) {
          console.log(`✓ No processes found running on port ${port}`);
          return resolve();
        }

        const pids = stdout.trim().split('\n').filter(pid => pid);
        console.log(`🔄 Found ${pids.length} process(es) on port ${port}, killing PIDs: ${pids.join(', ')}`);
        
        exec(`kill -9 ${pids.join(' ')}`, (killError) => {
          if (killError) {
            console.log(`⚠️  Error killing processes: ${killError.message}`);
          } else {
            console.log(`✓ Killed ${pids.length} process(es)`);
          }
          setTimeout(() => resolve(), 1000); // Wait 1s after killing
        });
      });
    }
  });
};

// Function to display environment information
const displayEnvironmentInfo = () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 SERVER STARTUP INFORMATION');
  console.log('='.repeat(50));
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🖥️  Platform: ${process.platform} (${process.arch})`);
  console.log(`⚡ Node.js: ${process.version}`);
  console.log(`📁 Working Directory: ${process.cwd()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Port: ${port}`);
  console.log(`🏠 Host: localhost`);
  
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    console.log(`☁️  Deployment: Vercel (Serverless)`);
    console.log(`📦 Vercel Environment: ${process.env.VERCEL_ENV || 'unknown'}`);
    console.log(`🌐 Vercel URL: ${process.env.VERCEL_URL || 'unknown'}`);
  } else {
    console.log(`🖱️  Deployment: Local Development Server`);
  }
  
  console.log(`💾 Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
  console.log('='.repeat(50) + '\n');
};

// Function to start server with error handling
const startServer = () => {
  const server = app.listen(port, 'localhost', () => {
    console.log(`✅ Server successfully started!`);
    console.log(`🌐 Access your application at: http://localhost:${port}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, 'public')}`);
    console.log('\n📋 Available API Endpoints:');
    console.log('   GET  / → Serves static files from public/');
    console.log('   POST /save-master-json → Save JSON data to master.json');
    console.log('   GET  /list-files → List all files in public directory');
    console.log('   GET  /public/* → Direct access to static files');
    console.log('\n🔍 Real-time Request Logging:');
    console.log('   📥 Incoming requests | 📤 Response status | 🚫 404 errors | ❌ Server errors');
    console.log(`\n⏹️  Press Ctrl+C to stop the server\n`);
  });

  // Enhanced error handling
  server.on('error', (error) => {
    console.error('\n❌ SERVER ERROR:');
    console.error('='.repeat(30));
    
    if (error.code === 'EADDRINUSE') {
      console.error(`🚫 Port ${port} is already in use!`);
      console.error(`💡 Try running the server again, it will automatically kill existing processes.`);
    } else if (error.code === 'EACCES') {
      console.error(`🔒 Permission denied to bind to port ${port}`);
      console.error(`💡 Try using a different port or run with administrator privileges.`);
    } else {
      console.error(`🔥 Error: ${error.message}`);
      console.error(`📋 Code: ${error.code}`);
    }
    
    console.error('='.repeat(30));
    process.exit(1);
  });

  // Handle graceful shutdown for local development
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('✅ Server stopped successfully');
      process.exit(0);
    });
    
    // Force exit if server doesn't close within 5 seconds
    setTimeout(() => {
      console.log('⚠️  Forcing server shutdown...');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  return server;
};

// Start the server
// Check if running in Vercel environment
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

if (isVercel) {
  // Export for Vercel serverless
  displayEnvironmentInfo();
  console.log('☁️  Exporting app for Vercel serverless deployment...');
  module.exports = app;
} else {
  // Start server for local development
  displayEnvironmentInfo();
  
  console.log('🔍 Checking for existing processes on port ' + port + '...');
  killProcessesOnPort(port).then(() => {
    console.log('🚀 Starting local development server...\n');
    startServer();
  }).catch((error) => {
    console.error('❌ Error during startup:', error);
    process.exit(1);
  });
}


