/* --------------------------------------------------
   DONE BY: Saidah & Shah (PostgreSQL Version)
-------------------------------------------------- */

// Core dependencies
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// Database setup
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

// Connect to Render PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render
    }
});

// App setup
const app = express();
const port = process.env.PORT || 3000;

// Trust proxy (Required for Render sessions)
app.set('trust proxy', 1);

/* --------------------------------------------------
   Database Initialization (Creates Tables automatically)
-------------------------------------------------- */
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type TEXT NOT NULL, -- 'Indoor' or 'Outdoor'
                "itemOrfacility" TEXT,
                description TEXT,
                comment TEXT,
                image TEXT,
                priority INTEGER,
                "estimatedCost" INTEGER
            );
            CREATE TABLE IF NOT EXISTS session (
                sid varchar NOT NULL COLLATE "default",
                sess json NOT NULL,
                expire timestamp(6) NOT NULL
            )
            WITH (OIDS=FALSE);
            
            ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
            CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);
        `);
        console.log("Database tables checked/created successfully.");
    } catch (err) {
        // Ignore error if session table already exists
        if (!err.message.includes('already exists')) {
            console.error("Error initializing DB:", err);
        }
    }
}
initDB();

/* --------------------------------------------------
   Metrics & Health
-------------------------------------------------- */
const client = require('prom-client');
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

/* --------------------------------------------------
   Middleware
-------------------------------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Middleware (Now stored in Database, not files)
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production' // true on Render
    }
}));

// Static files
app.use(express.static('css'));
app.use(express.static('uploads'));
app.use(express.static('html')); // Added to serve html files if needed directly

/* --------------------------------------------------
   File Uploads (Multer)
   NOTE: Images on Render are still temporary. 
   Use a cloud service (like Cloudinary) for permanent images.
-------------------------------------------------- */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg'];
        if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
            return cb(new Error('Invalid file type'));
        }
        cb(null, true);
    }
});

/* --------------------------------------------------
   Helper Functions
-------------------------------------------------- */
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    next();
}

/* --------------------------------------------------
   Auth Routes
-------------------------------------------------- */

// Login Page
app.get('/', (req, res) => {
    if (req.session && req.session.userId) return res.redirect('/home');
    res.sendFile(__dirname + "/html/login.html");
});

// Handle Login
app.post('/', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (bcrypt.compareSync(password, user.password)) {
                req.session.userId = user.id;
                req.session.username = user.username;
                return res.redirect('/home');
            }
        }
        res.send('<p>Invalid username or password.</p><a href="/">Back</a>');
    } catch (err) {
        console.error(err);
        res.send('Login error');
    }
});

// Create Account Page
app.get('/createAccount', (req, res) => {
    res.sendFile(__dirname + "/html/createAccount.html");
});

// Handle Create Account
app.post('/createAccount', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    if (!username || !email || !password || !confirmPassword) {
        return res.send('<p>All fields are required.</p><a href="/createAccount">Back</a>');
    }
    if (password !== confirmPassword) {
        return res.send('<p>Passwords do not match.</p><a href="/createAccount">Back</a>');
    }

    try {
        const hashed = bcrypt.hashSync(password, 10);
        await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
            [username, email, hashed]
        );
        res.redirect('/');
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // Unique violation
            return res.send('<p>Username already taken.</p><a href="/createAccount">Back</a>');
        }
        res.send('Error creating account');
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

/* --------------------------------------------------
   Main App Routes
-------------------------------------------------- */

app.get('/home', requireLogin, (req, res) => {
    res.sendFile(__dirname + "/html/coverpage.html");
});

app.get('/selectLocation', (req, res) => {
    res.sendFile(__dirname + "/html/location.html")
});

// Helper to generate list HTML (shared by Indoor and Outdoor)
function generateListHTML(layouts, title, addLink, backLink, deleteRoute, editRoute) {
    let listItems = '';
    layouts.forEach(item => {
        listItems += 
        `<li data-item="${item.itemOrfacility}" data-priority="${item.priority}" data-cost="${item.estimatedCost}" data-id="${item.id}">
            <h2><b>${item.itemOrfacility}</b></h2>
            <b>Priority Level:</b> <p>${item.priority}</p>
            <b>Estimated Cost:</b> <p>$${item.estimatedCost}</p>
            <b>Description:</b> <p>${item.description}</p>
            <b>Comment:</b> <p>${item.comment}</p>
            <b>Image:</b> <p><img src="${item.image}" class="rounded" width="200" height="200"></p>
            <a href="/${editRoute}/${item.id}">Edit</a>
            <p> </p>
            <button type="button" onclick="deleteItem('${deleteRoute}', ${item.id})">Delete</button>
        </li>`;
    });

    return `
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="/${title === 'Indoor' ? 'homeListIndoor' : 'homeListOutdoor'}.css">
            <title>Home List</title>
        </head>
        <body>
            <div class="container">
                <h1>${title} Home List</h1>
                <div style="margin-bottom: 15px;">
                    <input type="text" id="searchBox" placeholder="Search..." style="padding: 8px;">
                </div>
            </div>
            <ul style="margin-top: 0px;" id="itemList">${listItems}</ul>
            <a class="btn btn-primary m-2" href='/${addLink}'>Add a List</a>
            <a class="btn btn-primary m-2" href='/home'>Back to Home</a>
            <a class="btn btn-primary m-2" href='/logout'>Logout</a>
            <script>
                // Basic Delete Function
                function deleteItem(route, id) {
                    if (confirm('Delete this item?')) {
                        fetch('/' + route + '/' + id, { method: 'POST' })
                            .then(res => res.json())
                            .then(data => { if(data.success) location.reload(); });
                    }
                }
                // (You can add your filter scripts back here if needed)
            </script>
        </body>
        </html>`;
}

/* --------------------------------------------------
   Indoor Routes
-------------------------------------------------- */
app.get('/homeListsIndoor', requireLogin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM items WHERE user_id = $1 AND type = $2',
            [req.session.userId, 'Indoor']
        );
        res.send(generateListHTML(result.rows, 'Indoor', 'addListIndoor', 'home', 'deleteListIndoor', 'editListIndoor'));
    } catch (err) {
        console.error(err);
        res.send('Error loading lists');
    }
});

app.get('/addListIndoor', requireLogin, (req, res) => {
    res.sendFile(__dirname + "/html/addlistIndoor.html");
});

app.post('/addListIndoor', requireLogin, upload.single('image'), async (req, res) => {
    try {
        const image = req.file ? req.file.filename : 'default.jpg';
        await pool.query(
            `INSERT INTO items (user_id, type, "itemOrfacility", description, comment, image, priority, "estimatedCost") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [req.session.userId, 'Indoor', req.body.itemOrfacility, req.body.description, req.body.comment, image, req.body.priority, req.body.estimatedCost]
        );
        res.redirect('/homeListsIndoor');
    } catch (err) {
        console.error(err);
        res.send("Error adding item");
    }
});

app.post('/deleteListIndoor/:id', requireLogin, async (req, res) => {
    try {
        await pool.query('DELETE FROM items WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

app.get('/editListIndoor/:id', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM items WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        if (result.rows.length === 0) return res.redirect('/homeListsIndoor');
        const item = result.rows[0];
        
        // Render the Edit Form (Same HTML structure as your original code)
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
    } catch (err) {
        console.error(err);
        res.send("Error");
    }
});

app.post('/editListIndoor/:id', requireLogin, upload.single('image'), async (req, res) => {
    try {
        let query = `UPDATE items SET "itemOrfacility"=$1, description=$2, comment=$3, priority=$4, "estimatedCost"=$5 WHERE id=$6 AND user_id=$7`;
        let params = [req.body.itemOrfacility, req.body.description, req.body.comment, req.body.priority, req.body.estimatedCost, req.params.id, req.session.userId];
        
        if (req.file) {
            query = `UPDATE items SET "itemOrfacility"=$1, description=$2, comment=$3, priority=$4, "estimatedCost"=$5, image=$6 WHERE id=$7 AND user_id=$8`;
            params = [req.body.itemOrfacility, req.body.description, req.body.comment, req.body.priority, req.body.estimatedCost, req.file.filename, req.params.id, req.session.userId];
        }

        await pool.query(query, params);
        res.redirect('/homeListsIndoor');
    } catch (err) {
        console.error(err);
        res.send("Error updating");
    }
});

/* --------------------------------------------------
   Outdoor Routes (Exact copy of Indoor logic but with type='Outdoor')
-------------------------------------------------- */
app.get('/homeListsOutdoor', requireLogin, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM items WHERE user_id = $1 AND type = $2',
            [req.session.userId, 'Outdoor']
        );
        res.send(generateListHTML(result.rows, 'Outdoor', 'addListOutdoor', 'home', 'deleteListOutdoor', 'editListOutdoor'));
    } catch (err) {
        console.error(err);
        res.send('Error loading lists');
    }
});

app.get('/addListOutdoor', requireLogin, (req, res) => {
    res.sendFile(__dirname + "/html/addlistOutdoor.html");
});

app.post('/addListOutdoor', requireLogin, upload.single('image'), async (req, res) => {
    try {
        const image = req.file ? req.file.filename : 'default.jpg';
        await pool.query(
            `INSERT INTO items (user_id, type, "itemOrfacility", description, comment, image, priority, "estimatedCost") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [req.session.userId, 'Outdoor', req.body.itemOrfacility, req.body.description, req.body.comment, image, req.body.priority, req.body.estimatedCost]
        );
        res.redirect('/homeListsOutdoor');
    } catch (err) {
        console.error(err);
        res.send("Error adding item");
    }
});

app.post('/deleteListOutdoor/:id', requireLogin, async (req, res) => {
    try {
        await pool.query('DELETE FROM items WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

app.get('/editListOutdoor/:id', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM items WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
        if (result.rows.length === 0) return res.redirect('/homeListsOutdoor');
        const item = result.rows[0];
        
        // Use the same HTML form logic as Indoor, just point action to Outdoor
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
    } catch (err) {
        console.error(err);
        res.send("Error");
    }
});

app.post('/editListOutdoor/:id', requireLogin, upload.single('image'), async (req, res) => {
    try {
        let query = `UPDATE items SET "itemOrfacility"=$1, description=$2, comment=$3, priority=$4, "estimatedCost"=$5 WHERE id=$6 AND user_id=$7`;
        let params = [req.body.itemOrfacility, req.body.description, req.body.comment, req.body.priority, req.body.estimatedCost, req.params.id, req.session.userId];
        
        if (req.file) {
            query = `UPDATE items SET "itemOrfacility"=$1, description=$2, comment=$3, priority=$4, "estimatedCost"=$5, image=$6 WHERE id=$7 AND user_id=$8`;
            params = [req.body.itemOrfacility, req.body.description, req.body.comment, req.body.priority, req.body.estimatedCost, req.file.filename, req.params.id, req.session.userId];
        }
        await pool.query(query, params);
        res.redirect('/homeListsOutdoor');
    } catch (err) {
        console.error(err);
        res.send("Error updating");
    }
});


if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
}

module.exports = app;