const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;

/* --------------------------------------------------
   Trust proxy (REQUIRED for Render sessions)
-------------------------------------------------- */
app.set('trust proxy', 1);

/* --------------------------------------------------
   Body parsing
-------------------------------------------------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* --------------------------------------------------
   Session (ONLY ONCE)
-------------------------------------------------- */
app.use(session({
    store: new FileStore({}),
    secret: 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24
    }
}));

/* --------------------------------------------------
   Login rate limiter
-------------------------------------------------- */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
});
app.use('/', loginLimiter);

/* --------------------------------------------------
   Static files
-------------------------------------------------- */
app.use('/css', express.static('css'));
app.use('/uploads', express.static('uploads'));

/* --------------------------------------------------
   Uploads setup
-------------------------------------------------- */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }
});

/* --------------------------------------------------
   User storage (file-based)
-------------------------------------------------- */
const usersDir = path.join(__dirname, 'data', 'users');
if (!fs.existsSync('data')) fs.mkdirSync('data');
if (!fs.existsSync(usersDir)) fs.mkdirSync(usersDir);

function saveUser(user) {
    fs.writeFileSync(
        path.join(usersDir, user.username + '.json'),
        JSON.stringify(user, null, 2)
    );
}

function getUser(username) {
    const file = path.join(usersDir, username + '.json');
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getCurrentUser(req) {
    if (req.session && req.session.user) {
        return getUser(req.session.user.username);
    }
    return null;
}

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/');
    }
    next();
}

/* --------------------------------------------------
   Auth pages
-------------------------------------------------- */
app.get('/', (req, res) => {
    if (req.session.user) return res.redirect('/home');
    res.sendFile(__dirname + '/html/login.html');
});

app.get('/createAccount', (req, res) => {
    if (req.session.user) return res.redirect('/home');
    res.sendFile(__dirname + '/html/createAccount.html');
});

/* --------------------------------------------------
   Create account
-------------------------------------------------- */
app.post('/createAccount', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
        return res.send('All fields required');
    }

    if (password !== confirmPassword) {
        return res.send('Passwords do not match');
    }

    if (getUser(username)) {
        return res.send('Username already exists');
    }

    const user = {
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        layoutsIndoor: [],
        layoutsOutdoor: []
    };

    saveUser(user);
    res.redirect('/');
});

/* --------------------------------------------------
   Login
-------------------------------------------------- */
app.post('/', (req, res) => {
    const { username, password } = req.body;

    const user = getUser(username);
    if (!user) return res.send('Invalid login');

    if (!bcrypt.compareSync(password, user.password)) {
        return res.send('Invalid login');
    }

    req.session.user = {
        username: user.username,
        email: user.email
    };

    req.session.save(() => {
        res.redirect('/home');
    });
});

/* --------------------------------------------------
   Logout
-------------------------------------------------- */
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

/* --------------------------------------------------
   Home
-------------------------------------------------- */
app.get('/home', requireLogin, (req, res) => {
    res.sendFile(__dirname + '/html/coverpage.html');
});

/* --------------------------------------------------
   Add Indoor
-------------------------------------------------- */
app.get('/addListIndoor', requireLogin, (req, res) => {
    res.sendFile(__dirname + '/html/addlistIndoor.html');
});

app.post('/addListIndoor', requireLogin, upload.single('image'), (req, res) => {
    const user = getCurrentUser(req);
    const id = user.layoutsIndoor.length + 1;

    user.layoutsIndoor.push({
        id,
        itemOrfacility: req.body.itemOrfacility,
        description: req.body.description,
        comment: req.body.comment,
        image: req.file ? req.file.filename : 'default.jpg',
        priority: parseInt(req.body.priority),
        estimatedCost: parseInt(req.body.estimatedCost)
    });

    saveUser(user);
    res.redirect('/homeListsIndoor');
});

/* --------------------------------------------------
   Indoor list
-------------------------------------------------- */
app.get('/homeListsIndoor', requireLogin, (req, res) => {
    const user = getCurrentUser(req);
    res.send(JSON.stringify(user.layoutsIndoor));
});

/* --------------------------------------------------
   Server start
-------------------------------------------------- */
if (require.main === module) {
    app.listen(port, () => {
        console.log('Server running on port ' + port);
    });
}

module.exports = app;
