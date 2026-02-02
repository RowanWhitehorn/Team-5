/* --------------------------------------------------
   DONE BY: Saidah & Shah (SQLite Version - No PostgreSQL)
   Compatible with Express 5.x and your existing dependencies
   REFACTORED: Improved code organization and readability
-------------------------------------------------- */

// Core dependencies
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const FileStore = require('session-file-store')(session);

// App setup
const app = express();
const port = process.env.PORT || 3000;

/* --------------------------------------------------
   CONSTANTS
-------------------------------------------------- */
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const SESSION_DIR = './sessions';
const DATABASE_PATH = './database.db';
const SESSION_SECRET = 'change-this-secret';
const SESSION_TTL_DAYS = 30;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['.png', '.jpg', '.jpeg'];
const PASSWORD_MIN_LENGTH = 6;
const PRIORITY_MIN = 1;
const PRIORITY_MAX = 5;

/* --------------------------------------------------
   Database Setup & Initialization
-------------------------------------------------- */
const db = new sqlite3.Database(DATABASE_PATH, (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Initialize database tables
const initializeDatabase = () => {
    db.serialize(() => {
        // Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                password TEXT NOT NULL
            )
        `);

        // Items table
        db.run(`
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                type TEXT NOT NULL,
                itemOrfacility TEXT,
                description TEXT,
                comment TEXT,
                image TEXT,
                priority INTEGER,
                estimatedCost INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log("Database tables initialized");
    });
};

initializeDatabase();

/* --------------------------------------------------
   Metrics & Health Monitoring
-------------------------------------------------- */
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

/* --------------------------------------------------
   Middleware Configuration
-------------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new FileStore({
        path: SESSION_DIR,
        ttl: SESSION_TTL_DAYS * 24 * 60 * 60
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    }
}));

// Static files
app.use(express.static('css'));
app.use(express.static('uploads'));
app.use(express.static('html'));

/* --------------------------------------------------
   File Upload Configuration (Multer)
-------------------------------------------------- */
// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_FILE_TYPES.includes(ext)) {
            return cb(new Error('Invalid file type'));
        }
        cb(null, true);
    }
});

/* --------------------------------------------------
   Helper Functions & Middleware
-------------------------------------------------- */

/**
 * Middleware to require user authentication
 */
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    next();
}

/**
 * Check if user is authenticated (for API endpoints)
 */
function isAuthenticated(req) {
    return req.session && req.session.userId;
}

/**
 * Hash password using bcrypt
 */
function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

/**
 * Verify password against hash
 */
function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

/**
 * Generate HTML for item lists (Indoor/Outdoor)
 */
function generateListHTML(layouts, title, addLink, backLink, deleteRoute, editRoute) {
    const listItems = layouts.map(item => `
        <li data-item="${item.itemOrfacility}" data-priority="${item.priority}" data-cost="${item.estimatedCost}" data-id="${item.id}">
            <h2><b>${item.itemOrfacility}</b></h2>
            <b>Priority Level:</b> <p>${item.priority}</p>
            <b>Estimated Cost:</b> <p>$${item.estimatedCost}</p>
            <b>Description:</b> <p>${item.description}</p>
            <b>Comment:</b> <p>${item.comment}</p>
            <b>Image:</b> <p><img src="${item.image}" class="rounded" width="200" height="200"></p>
            <a href="/${editRoute}/${item.id}">Edit</a>
            <p> </p>
            <button type="button" onclick="deleteItem('${deleteRoute}', ${item.id})">Delete</button>
        </li>
    `).join('');

    const cssFile = title === 'Indoor' ? 'homeListIndoor' : 'homeListOutdoor';

    return `
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="/${cssFile}.css">
            <title>Home List</title>
        </head>
        <body>
            <div class="container">
                <h1>${title} Home List</h1>
                <div style="margin-bottom: 15px;">
                    <div>
                        <label for="priorityFilter" style="margin-right: 10px; font-weight: bold;">Filter by Priority:</label>
                        <select id="priorityFilter" style="padding: 8px; margin-right: 20px; font-size: 13px;">
                            <option value="">All Priorities</option>
                            <option value="1">Priority 1 (Most Priority)</option>
                            <option value="2">Priority 2 (Medium Priority)</option>
                            <option value="3">Priority 3 (Least Priority)</option>
                        </select>
                        <label for="costFilter" style="margin-right: 10px; font-weight: bold;">Filter by Cost:</label>
                        <select id="costFilter" style="padding: 8px; font-size: 13px;">
                            <option value="">All Costs</option>
                            <option value="1000">< $1000</option>
                            <option value="3000">$1000 - $3000</option>
                            <option value="10000">> $3000</option>
                        </select>
                        <input type="text" id="searchBox" placeholder="Search items or facilities..." style="padding: 8px; width: 300px; font-size: 13px; margin-left: 23px;">
                    </div>
                </div>
            </div>
            <ul style="margin-top: 0px;" id="itemList">${listItems}</ul>
            <a class="btn btn-primary m-2" id="homeBtn" href='/${addLink}'>Add a List</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/home'>Back to Home</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/logout'>Logout</a>
            <script>
                function deleteItem(route, id) {
                    if (confirm('Delete this item?')) {
                        fetch('/' + route + '/' + id, { method: 'POST' })
                            .then(res => res.json())
                            .then(data => { if(data.success) location.reload(); });
                    }
                }
            </script>
        </body>
        </html>`;
}

/* --------------------------------------------------
   Authentication Routes
-------------------------------------------------- */

/**
 * GET / - Login page or redirect to home if logged in
 */
app.get('/', (req, res) => {
    if (isAuthenticated(req)) {
        return res.redirect('/home');
    }
    res.sendFile(path.join(__dirname, 'html', 'login.html'));
});

/**
 * POST / - Handle login submission
 */
app.post('/', async (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Login query error:', err);
            return res.send('Login error');
        }
        
        if (user && verifyPassword(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = user.username;
            return res.redirect('/home');
        }
        
        res.send('<p>Invalid username or password.</p><a href="/">Back</a>');
    });
});

/**
 * POST /login - Alias route for login (for tests)
 */
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Login query error:', err);
            return res.status(500).send('Login error');
        }
        
        if (user && verifyPassword(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = user.username;
            return res.redirect('/home');
        }
        
        res.status(404).send('<p>Invalid username or password.</p><a href="/">Back</a>');
    });
});

/**
 * GET /createAccount - Create account page
 */
app.get('/createAccount', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'createAccount.html'));
});

/**
 * POST /createAccount - Handle account creation
 */
app.post('/createAccount', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    // Validation
    if (!username || !email || !password || !confirmPassword) {
        return res.send('<p>All fields are required.</p><a href="/createAccount">Back</a>');
    }
    
    if (password.length < PASSWORD_MIN_LENGTH) {
        return res.send(`<p>Password must be at least ${PASSWORD_MIN_LENGTH} characters</p><a href="/createAccount">Back</a>`);
    }
    
    if (password !== confirmPassword) {
        return res.send('<p>Passwords do not match.</p><a href="/createAccount">Back</a>');
    }

    const hashedPassword = hashPassword(password);
    
    db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
            if (err) {
                console.error('Account creation error:', err);
                if (err.message.includes('UNIQUE')) {
                    return res.send('<p>Username already taken.</p><a href="/createAccount">Back</a>');
                }
                return res.send('Error creating account');
            }
            res.redirect('/');
        }
    );
});

/**
 * GET /logout - Destroy session and logout
 */
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

/* --------------------------------------------------
   Main Application Routes
-------------------------------------------------- */

/**
 * GET /home - Main home page (requires login)
 */
app.get('/home', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'coverpage.html'));
});

/**
 * GET /selectLocation - Location selection page
 */
app.get('/selectLocation', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'location.html'));
});

/* --------------------------------------------------
   Indoor List Routes
-------------------------------------------------- */

/**
 * GET /homeListsIndoor - View all indoor items
 */
app.get('/homeListsIndoor', requireLogin, (req, res) => {
    db.all(
        'SELECT * FROM items WHERE user_id = ? AND type = ?',
        [req.session.userId, 'Indoor'],
        (err, rows) => {
            if (err) {
                console.error('Error fetching indoor items:', err);
                return res.send('Error loading lists');
            }
            const html = generateListHTML(
                rows, 
                'Indoor', 
                'addListIndoor', 
                'home', 
                'deleteListIndoor', 
                'editListIndoor'
            );
            res.send(html);
        }
    );
});

/**
 * GET /addListIndoor - Add indoor item page
 */
app.get('/addListIndoor', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'addlistIndoor.html'));
});

/**
 * POST /addListIndoor - Create new indoor item
 */
app.post('/addListIndoor', requireLogin, upload.single('image'), (req, res) => {
    const image = req.file ? req.file.filename : 'default.jpg';
    const { itemOrfacility, description, comment, priority, estimatedCost } = req.body;
    
    db.run(
        `INSERT INTO items (user_id, type, itemOrfacility, description, comment, image, priority, estimatedCost) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.session.userId, 'Indoor', itemOrfacility, description, comment, image, priority, estimatedCost],
        (err) => {
            if (err) {
                console.error('Error adding indoor item:', err);
                return res.send("Error adding item");
            }
            res.redirect('/homeListsIndoor');
        }
    );
});

/**
 * POST /deleteListIndoor/:id - Delete indoor item
 */
app.post('/deleteListIndoor/:id', (req, res) => {
    if (!isAuthenticated(req)) {
        return res.json({ success: false });
    }
    
    db.run(
        'DELETE FROM items WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        (err) => {
            if (err) {
                console.error('Error deleting indoor item:', err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

/**
 * GET /editListIndoor/:id - Edit indoor item page
 */
app.get('/editListIndoor/:id', requireLogin, (req, res) => {
    db.get(
        'SELECT * FROM items WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        (err, item) => {
            if (err || !item) {
                console.error('Error fetching indoor item for edit:', err);
                return res.redirect('/homeListsIndoor');
            }
            
            res.send(`
                <form action="/editListIndoor/${item.id}" method="POST" enctype="multipart/form-data">
                    Item: <input name="itemOrfacility" value="${item.itemOrfacility}" required /> <br>
                    Desc: <input name="description" value="${item.description}" required /> <br>
                    Comment: <input name="comment" value="${item.comment}" required /> <br>
                    Priority: <input name="priority" value="${item.priority}" required /> <br>
                    Cost: <input name="estimatedCost" value="${item.estimatedCost}" required /> <br>
                    Image: <input type="file" name="image" /> <br>
                    <button type="submit">Update</button>
                </form>
            `);
        }
    );
});

/**
 * POST /editListIndoor/:id - Update indoor item
 */
app.post('/editListIndoor/:id', requireLogin, upload.single('image'), (req, res) => {
    const { itemOrfacility, description, comment, priority, estimatedCost } = req.body;
    let query, params;
    
    if (req.file) {
        query = `UPDATE items SET itemOrfacility=?, description=?, comment=?, priority=?, estimatedCost=?, image=? WHERE id=? AND user_id=?`;
        params = [itemOrfacility, description, comment, priority, estimatedCost, req.file.filename, req.params.id, req.session.userId];
    } else {
        query = `UPDATE items SET itemOrfacility=?, description=?, comment=?, priority=?, estimatedCost=? WHERE id=? AND user_id=?`;
        params = [itemOrfacility, description, comment, priority, estimatedCost, req.params.id, req.session.userId];
    }

    db.run(query, params, (err) => {
        if (err) {
            console.error('Error updating indoor item:', err);
            return res.send("Error updating");
        }
        res.redirect('/homeListsIndoor');
    });
});

/* --------------------------------------------------
   Outdoor List Routes
-------------------------------------------------- */

/**
 * GET /homeListsOutdoor - View all outdoor items
 */
app.get('/homeListsOutdoor', requireLogin, (req, res) => {
    db.all(
        'SELECT * FROM items WHERE user_id = ? AND type = ?',
        [req.session.userId, 'Outdoor'],
        (err, rows) => {
            if (err) {
                console.error('Error fetching outdoor items:', err);
                return res.send('Error loading lists');
            }
            const html = generateListHTML(
                rows, 
                'Outdoor', 
                'addListOutdoor', 
                'home', 
                'deleteListOutdoor', 
                'editListOutdoor'
            );
            res.send(html);
        }
    );
});

/**
 * GET /addListOutdoor - Add outdoor item page
 */
app.get('/addListOutdoor', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'addlistOutdoor.html'));
});

/**
 * POST /addListOutdoor - Create new outdoor item
 */
app.post('/addListOutdoor', requireLogin, upload.single('image'), (req, res) => {
    const image = req.file ? req.file.filename : 'default.jpg';
    const { itemOrfacility, description, comment, priority, estimatedCost } = req.body;
    
    db.run(
        `INSERT INTO items (user_id, type, itemOrfacility, description, comment, image, priority, estimatedCost) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.session.userId, 'Outdoor', itemOrfacility, description, comment, image, priority, estimatedCost],
        (err) => {
            if (err) {
                console.error('Error adding outdoor item:', err);
                return res.send("Error adding item");
            }
            res.redirect('/homeListsOutdoor');
        }
    );
});

/**
 * POST /deleteListOutdoor/:id - Delete outdoor item
 */
app.post('/deleteListOutdoor/:id', (req, res) => {
    if (!isAuthenticated(req)) {
        return res.json({ success: false });
    }
    
    db.run(
        'DELETE FROM items WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        (err) => {
            if (err) {
                console.error('Error deleting outdoor item:', err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

/**
 * GET /editListOutdoor/:id - Edit outdoor item page
 */
app.get('/editListOutdoor/:id', requireLogin, (req, res) => {
    db.get(
        'SELECT * FROM items WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        (err, item) => {
            if (err || !item) {
                console.error('Error fetching outdoor item for edit:', err);
                return res.redirect('/homeListsOutdoor');
            }
            
            res.send(`
                <form action="/editListOutdoor/${item.id}" method="POST" enctype="multipart/form-data">
                    Item: <input name="itemOrfacility" value="${item.itemOrfacility}" required /> <br>
                    Desc: <input name="description" value="${item.description}" required /> <br>
                    Comment: <input name="comment" value="${item.comment}" required /> <br>
                    Priority: <input name="priority" value="${item.priority}" required /> <br>
                    Cost: <input name="estimatedCost" value="${item.estimatedCost}" required /> <br>
                    Image: <input type="file" name="image" /> <br>
                    <button type="submit">Update</button>
                </form>
            `);
        }
    );
});

/**
 * POST /editListOutdoor/:id - Update outdoor item
 */
app.post('/editListOutdoor/:id', requireLogin, upload.single('image'), (req, res) => {
    const { itemOrfacility, description, comment, priority, estimatedCost } = req.body;
    let query, params;
    
    if (req.file) {
        query = `UPDATE items SET itemOrfacility=?, description=?, comment=?, priority=?, estimatedCost=?, image=? WHERE id=? AND user_id=?`;
        params = [itemOrfacility, description, comment, priority, estimatedCost, req.file.filename, req.params.id, req.session.userId];
    } else {
        query = `UPDATE items SET itemOrfacility=?, description=?, comment=?, priority=?, estimatedCost=? WHERE id=? AND user_id=?`;
        params = [itemOrfacility, description, comment, priority, estimatedCost, req.params.id, req.session.userId];
    }

    db.run(query, params, (err) => {
        if (err) {
            console.error('Error updating outdoor item:', err);
            return res.send("Error updating");
        }
        res.redirect('/homeListsOutdoor');
    });
});

/* --------------------------------------------------
   Security Testing Routes
-------------------------------------------------- */

/**
 * POST /upload - Test-only upload endpoint with error handling
 */
app.post('/upload', (req, res) => {
    const uploadHandler = upload.single('file');
    
    uploadHandler(req, res, (err) => {
        if (err) {
            return res.status(400).send(err.message);
        }
        
        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }
        
        res.send('Upload successful');
    });
});

/**
 * POST /addItem - Test-only input validation endpoint
 */
app.post('/addItem', (req, res) => {
    const { description, priority } = req.body;
    
    // Validate against script injection
    if (description && description.includes('<script>')) {
        return res.status(400).send('Invalid input');
    }
    
    // Validate priority range
    const priorityNum = Number(priority);
    if (isNaN(priorityNum) || priorityNum < PRIORITY_MIN || priorityNum > PRIORITY_MAX) {
        return res.status(400).send('Invalid priority');
    }
    
    res.send('Item accepted');
});

/* --------------------------------------------------
   Server Start
-------------------------------------------------- */
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
}

module.exports = app;