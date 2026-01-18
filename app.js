const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Session middleware - MUST come before static and routes
app.use(session({
    store: new FileStore({}),
    secret: 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Static files - after session
app.use(express.static('css'));
app.use(express.static('uploads'));

// Simple in-memory users store (username must be unique)
let users = [];

// Ensure data/users directory exists and load existing users
const usersDir = path.join(__dirname, 'data', 'users');
if (!fs.existsSync(path.join(__dirname, 'data'))){
    fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir);
} else {
    // load existing user files
    const files = fs.readdirSync(usersDir);
    files.forEach(file => {
        if (file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(path.join(usersDir, file), 'utf8');
                const obj = JSON.parse(content);
                if (obj.username) users.push(obj);
            } catch (e) {
                console.error('Failed to load user file', file, e);
            }
        }
    });
}

// Provide per-user lists and helper functions
function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Ensure each loaded user has per-user lists (empty by default)
users.forEach(u => {
    if (!u.layoutsIndoor) u.layoutsIndoor = [];
    if (!u.layoutsOutdoor) u.layoutsOutdoor = [];
});

function getUser(username) {
    // Try to load from file first for latest data
    try {
        const filePath = path.join(usersDir, `${username}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const user = JSON.parse(content);
            if (user) return user;
        }
    } catch (e) {
        console.error('Failed to load user from file:', username, e);
    }
    
    // Fallback to in-memory array
    const user = users.find(x => x.username === username);
    if (user) {
        // If found in memory but not in file, save it to file
        saveUser(user);
        return user;
    }
    return null;
}

function getCurrentUser(req) {
    if (req.session && req.session.user) {
        return getUser(req.session.user.username);
    }
    return null;
}

function saveUser(user) {
    try {
        fs.writeFileSync(path.join(usersDir, `${user.username}.json`), JSON.stringify(user, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save user file', user.username, e);
    }
}

app.use(express.static('css'));
app.use(express.static('uploads'));

app.get('/home', (req, res) => {
    res.sendFile(__dirname + "/html/coverpage.html");
});

app.get('/selectLocation', (req, res) => {
    res.sendFile(__dirname + "/html/location.html")
});

// Auth pages
app.get('/', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/home');
    res.sendFile(__dirname + "/html/login.html");
});

app.get('/createAccount', (req, res) => {
    if (req.session && req.session.user) return res.redirect('/home');
    res.sendFile(__dirname + "/html/createAccount.html");
});

// Handle account creation (hash password)
app.post('/createAccount', (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    if (!username || !email || !password || !confirmPassword) {
        return res.send('<p>All fields are required.</p><a href="/createAccount">Back</a>');
    }
    if (password.length < 6) {
        return res.send('<p>Password must be at least 6 characters.</p><a href="/createAccount">Back</a>');
    }
    if (password !== confirmPassword) {
        return res.send('<p>Passwords do not match.</p><a href="/createAccount">Back</a>');
    }
    const exists = users.find(u => u.username === username);
    if (exists) {
        return res.send('<p>Username already taken.</p><a href="/createAccount">Back</a>');
    }
    const hashed = bcrypt.hashSync(password, 10);
    const userObj = { username, email, password: hashed, layoutsIndoor: [], layoutsOutdoor: [] };
    users.push(userObj);
    // save user file
    saveUser(userObj);
    res.redirect('/');
});

// Handle login (compare hashed password)
app.post('/', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.send('<p>Missing credentials.</p><a href="/">Back</a>');
    
    // Try to load user from file first (most up-to-date), then fall back to memory
    let user = getUser(username);
    if (!user) {
        user = users.find(u => u.username === username);
    }
    
    if (!user) return res.send('<p>Invalid username or password.</p><a href="/">Back</a>');
    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.send('<p>Invalid username or password.</p><a href="/">Back</a>');
    req.session.user = { username: user.username, email: user.email };
    // Explicitly save the session
    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            return res.send('<p>Login error. Please try again.</p><a href="/">Back</a>');
        }
        res.redirect('/home');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

app.get('/homeListsIndoor', (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.redirect('/');
    const layouts = user.layoutsIndoor || [];
    let list = '';
    for (let i = 0; i < layouts.length; i++) {
        list += 
        `<li data-item="${layouts[i].itemOrfacility}" data-priority="${layouts[i].priority}" data-cost="${layouts[i].estimatedCost}" data-id="${layouts[i].id}">
            <h2><b>${layouts[i].itemOrfacility}</b></h2>
            <b>Priority Level:</b>
            <p>${layouts[i].priority}</p>
            <b>Estimated Cost:</b>
            <p>$${layouts[i].estimatedCost}</p>
            <b>Description:</b>
            <p>${layouts[i].description}</p>
            <b>Comment:</b>
            <p>${layouts[i].comment}</p>
            <b>Image:</b>
            <p><img src="${layouts[i].image}" class="rounded" width="200" height="200"></p>
            <a href="/editListIndoor/${layouts[i].id}">Edit</a>
            <p> </p>
            <button type="button" onclick="deleteListIndoor(${layouts[i].id})">Delete</button>
        </li>`;
    }
    res.send(`
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="/homeListIndoor.css">
            <title>Home List</title>
        </head>
        <body>
            <div class="container">
                <h1>Indoor Home List</h1>
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
            <ul style="margin-top: 0px;" id="itemList">${list}</ul>
            <a class="btn btn-primary m-2" id="homeBtn" href='/addListIndoor'>Add a List</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/home'>Back to Home</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/logout'>Logout</a>
            <script>
                const searchBox = document.getElementById('searchBox');
                const priorityFilter = document.getElementById('priorityFilter');
                const costFilter = document.getElementById('costFilter');
                const itemList = document.getElementById('itemList');
                const items = itemList.getElementsByTagName('li');
                
                function deleteListIndoor(id) {
                    if (confirm('Are you sure you want to delete this list?')) {
                        console.log('Deleting item with id:', id);
                        fetch('/deleteListIndoor/' + id, { method: 'POST', credentials: 'include' })
                            .then(res => {
                                console.log('Response status:', res.status);
                                return res.json();
                            })
                            .then(data => {
                                console.log('Response data:', data);
                                if (data.success) {
                                    const element = document.querySelector('li[data-id="' + id + '"]');
                                    console.log('Found element:', element);
                                    if (element) {
                                        element.remove();
                                        console.log('Item removed');
                                    }
                                }
                            })
                            .catch(err => console.error('Delete failed:', err));
                    }
                }
                
                function getCostRange(cost) {
                    if (cost < 1000) return 'low';
                    if (cost >= 1000 && cost <= 3000) return 'mid';
                    return 'high';
                }
                
                function filterItems() {
                    const searchTerm = searchBox.value.toLowerCase();
                    const selectedPriority = priorityFilter.value;
                    const selectedCost = costFilter.value;
                    
                    for (let i = 0; i < items.length; i++) {
                        const itemName = items[i].getAttribute('data-item').toLowerCase();
                        const itemPriority = items[i].getAttribute('data-priority');
                        const itemCost = parseInt(items[i].getAttribute('data-cost'));
                        const costRange = getCostRange(itemCost);
                        
                        const matchesSearch = itemName.includes(searchTerm);
                        const matchesPriority = selectedPriority === '' || itemPriority === selectedPriority;
                        
                        let matchesCost = selectedCost === '';
                        if (selectedCost === '1000') matchesCost = costRange === 'low';
                        if (selectedCost === '3000') matchesCost = costRange === 'mid';
                        if (selectedCost === '10000') matchesCost = costRange === 'high';
                        
                        if (matchesSearch && matchesPriority && matchesCost) {
                            items[i].style.display = 'block';
                        } else {
                            items[i].style.display = 'none';
                        }
                    }
                }
                
                searchBox.addEventListener('keyup', filterItems);
                priorityFilter.addEventListener('change', filterItems);
                costFilter.addEventListener('change', filterItems);
            </script>
        </body>
        </html>`);
});

app.get('/homeListsOutdoor', (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.redirect('/');
    const layouts = user.layoutsOutdoor || [];
    let list = '';
    for (let i = 0; i < layouts.length; i++) {
        list += 
        `<li data-item="${layouts[i].itemOrfacility}" data-priority="${layouts[i].priority}" data-cost="${layouts[i].estimatedCost}" data-id="${layouts[i].id}">
            <h2><b>${layouts[i].itemOrfacility}</b></h2>
            <b>Priority Level:</b>
            <p>${layouts[i].priority}</p>
            <b>Estimated Cost:</b>
            <p>$${layouts[i].estimatedCost}</p>
            <b>Description:</b>
            <p>${layouts[i].description}</p>
            <b>Comment:</b>
            <p>${layouts[i].comment}</p>
            <b>Image:</b>
            <p><img src="${layouts[i].image}" class="rounded" width="200" height="200"></p>
            <a href="/editListOutdoor/${layouts[i].id}">Edit</a>
            <p> </p>
            <button type="button" onclick="deleteListOutdoor(${layouts[i].id})">Delete</button>
        </li>`;
    }
    res.send(`
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="stylesheet" href="/homeListOutdoor.css">
            <title>Home List</title>
        </head>
        <body>
            <div class="container">
                <h1>Outdoor Home List</h1>
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
            <ul style="margin-top: 0px;" id="itemList">${list}</ul>
            <a class="btn btn-primary m-2" id="homeBtn" href='/addListOutdoor'>Add a List</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/home'>Back to Home</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/logout'>Logout</a>
            <script>
                const searchBox = document.getElementById('searchBox');
                const priorityFilter = document.getElementById('priorityFilter');
                const costFilter = document.getElementById('costFilter');
                const itemList = document.getElementById('itemList');
                const items = itemList.getElementsByTagName('li');
                
                function getCostRange(cost) {
                    if (cost < 1000) return 'low';
                    if (cost >= 1000 && cost <= 3000) return 'mid';
                    return 'high';
                }
                
                function filterItems() {
                    const searchTerm = searchBox.value.toLowerCase();
                    const selectedPriority = priorityFilter.value;
                    const selectedCost = costFilter.value;
                    
                    for (let i = 0; i < items.length; i++) {
                        const itemName = items[i].getAttribute('data-item').toLowerCase();
                        const itemPriority = items[i].getAttribute('data-priority');
                        const itemCost = parseInt(items[i].getAttribute('data-cost'));
                        const costRange = getCostRange(itemCost);
                        
                        const matchesSearch = itemName.includes(searchTerm);
                        const matchesPriority = selectedPriority === '' || itemPriority === selectedPriority;
                        
                        let matchesCost = selectedCost === '';
                        if (selectedCost === '1000') matchesCost = costRange === 'low';
                        if (selectedCost === '3000') matchesCost = costRange === 'mid';
                        if (selectedCost === '10000') matchesCost = costRange === 'high';
                        
                        if (matchesSearch && matchesPriority && matchesCost) {
                            items[i].style.display = 'block';
                        } else {
                            items[i].style.display = 'none';
                        }
                    }
                }
                
                searchBox.addEventListener('keyup', filterItems);
                priorityFilter.addEventListener('change', filterItems);
                costFilter.addEventListener('change', filterItems);
                
                function deleteListOutdoor(id) {
                    if (confirm('Are you sure you want to delete this list?')) {
                        console.log('Deleting outdoor item with id:', id);
                        fetch('/deleteListOutdoor/' + id, { method: 'POST', credentials: 'include' })
                            .then(res => {
                                console.log('Response status:', res.status);
                                return res.json();
                            })
                            .then(data => {
                                console.log('Response data:', data);
                                if (data.success) {
                                    const element = document.querySelector('li[data-id="' + id + '"]');
                                    console.log('Found element:', element);
                                    if (element) {
                                        element.remove();
                                        console.log('Item removed');
                                    }
                                }
                            })
                            .catch(err => console.error('Delete failed:', err));
                    }
                }
            </script>
        </body>
        </html>`);
});

app.get('/addListIndoor', (req, res) => {
    res.sendFile(__dirname + "/html/addlistIndoor.html")
});

app.get('/addListOutdoor', (req, res) => {
    res.sendFile(__dirname + "/html/addlistOutdoor.html")
});

// Middleware to parse form data from POST request
app.use(express.urlencoded({ extended: true }));

app.post('/addListIndoor', upload.single('image'), (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.redirect('/');
    const layouts = user.layoutsIndoor || [];
    const newId = layouts.length + 1;
    layouts.push({ 
        id: newId, 
        itemOrfacility: req.body.itemOrfacility, 
        description: req.body.description, 
        comment: req.body.comment,
        image: req.file ? req.file.filename : 'default.jpg',
        priority: parseInt(req.body.priority) || 1,
        estimatedCost: parseInt(req.body.estimatedCost) || 1000
    });
    user.layoutsIndoor = layouts;
    saveUser(user);
    res.redirect('/homeListsIndoor');
});

app.post('/addListOutdoor', upload.single('image'), (req, res) => {
    const user = getCurrentUser(req);
    if (!user) return res.redirect('/');
    const layouts = user.layoutsOutdoor || [];
    const newId = layouts.length + 1;
    layouts.push({ 
        id: newId, 
        itemOrfacility: req.body.itemOrfacility, 
        description: req.body.description, 
        comment: req.body.comment,
        image: req.file ? req.file.filename : 'default.jpg',
        priority: parseInt(req.body.priority) || 1,
        estimatedCost: parseInt(req.body.estimatedCost) || 1000
    });
    user.layoutsOutdoor = layouts;
    saveUser(user);
    res.redirect('/homeListsOutdoor');
});

app.post('/deleteListIndoor/:id', (req, res) => {
    try {
        const sessionUser = getCurrentUser(req);
        console.log('Delete Indoor - Current user:', sessionUser ? sessionUser.username : 'null');
        if (!sessionUser) {
            console.log('No user found, returning false');
            return res.json({ success: false });
        }
        // Reload user from file to get latest data
        const user = getUser(sessionUser.username);
        if (!user) {
            console.log('User not found in file, returning false');
            return res.json({ success: false });
        }
        if (!user.layoutsIndoor) {
            console.log('User has no layoutsIndoor array, returning false');
            return res.json({ success: false });
        }
        const id = parseInt(req.params.id);
        console.log('Delete Indoor - Deleting item:', id, 'from', user.layoutsIndoor.length, 'items');
        user.layoutsIndoor = user.layoutsIndoor.filter(b => b.id !== id);
        console.log('Delete Indoor - After filter:', user.layoutsIndoor.length, 'items');
        saveUser(user);
        console.log('Delete Indoor - Success');
        res.json({ success: true });
    } catch (err) {
        console.error('Delete Indoor error:', err);
        res.json({ success: false });
    }
});

app.post('/deleteListOutdoor/:id', (req, res) => {
    try {
        const sessionUser = getCurrentUser(req);
        console.log('Delete Outdoor - Current user:', sessionUser ? sessionUser.username : 'null');
        if (!sessionUser) {
            console.log('No user found, returning false');
            return res.json({ success: false });
        }
        // Reload user from file to get latest data
        const user = getUser(sessionUser.username);
        if (!user) {
            console.log('User not found in file, returning false');
            return res.json({ success: false });
        }
        if (!user.layoutsOutdoor) {
            console.log('User has no layoutsOutdoor array, returning false');
            return res.json({ success: false });
        }
        const id = parseInt(req.params.id);
        console.log('Delete Outdoor - Deleting item:', id, 'from', user.layoutsOutdoor.length, 'items');
        user.layoutsOutdoor = user.layoutsOutdoor.filter(b => b.id !== id);
        console.log('Delete Outdoor - After filter:', user.layoutsOutdoor.length, 'items');
        saveUser(user);
        console.log('Delete Outdoor - Success');
        res.json({ success: true });
    } catch (err) {
        console.error('Delete Outdoor error:', err);
        res.json({ success: false });
    }
});


// Edit Book Form Page
app.get('/editListIndoor/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const sessionUser = getCurrentUser(req);
    if (!sessionUser) return res.redirect('/');
    // Reload user from file to ensure latest data
    const user = getUser(sessionUser.username);
    if (!user) return res.redirect('/');
    let layoutIndoor = null;
    const layouts = user.layoutsIndoor || [];
    for (let i = 0; i < layouts.length; i++) {
        if (layouts[i].id === id) {
            layoutIndoor = layouts[i];
            break;
        }
    }

    if (!layoutIndoor) {
        return res.send('<p>List not found.</p><a href="/homeListsIndoor">Back to List</a>');
    }

    res.send(`
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="stylesheet" href="/editListIndoor.css">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
                <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>
                <script src="https://cdn.jsdelivr.net/npm/popper.js@1.12.9/dist/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
                <title>Edit List</title>
            </head>

            <body>
                <div class="center-box">
                    <div>
                        <div>
                            <div>
                                <h1>Edit Indoor List!</h1>
                                <form action="/editListIndoor/${layoutIndoor.id}" method="POST" enctype="multipart/form-data">
                                    <b>Item or Facility:</b> <input name="itemOrfacility" value="${layoutIndoor.itemOrfacility}" required /> <br><br>
                                    <b>Description:</b> <input name="description" value="${layoutIndoor.description}" required /> <br><br> 
                                    <b>Comment:</b> <input name="comment" value="${layoutIndoor.comment}" required /> <br><br>
                                    <b>Priority Level:</b> <select name="priority" required>
                                        <option value="1" ${layoutIndoor.priority === 1 ? 'selected' : ''}>Priority 1 (Most Priority)</option>
                                        <option value="2" ${layoutIndoor.priority === 2 ? 'selected' : ''}>Priority 2 (Medium Priority)</option>
                                        <option value="3" ${layoutIndoor.priority === 3 ? 'selected' : ''}>Priority 3 (Least Priority)</option>
                                    </select> <br><br>
                                    <b>Estimated Cost:</b> <input type="number" name="estimatedCost" value="${layoutIndoor.estimatedCost}" required /> <br><br> 
                                    <b>Image:</b> <input type="file" name="image" placeholder="image" /> <br><br>
                                    <button type="submit">Update List</button>
                                </form>
                                <p> </p>
                                <a href="/homeListsIndoor">Back to List</a>
                            </div>
                        </div>
                    </div>
                </div>
            </body>  
    `);
});

app.get('/editListOutdoor/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const sessionUser = getCurrentUser(req);
    if (!sessionUser) return res.redirect('/');
    // Reload user from file to ensure latest data
    const user = getUser(sessionUser.username);
    if (!user) return res.redirect('/');
    let layoutOutdoor = null;
    const layouts = user.layoutsOutdoor || [];
    for (let i = 0; i < layouts.length; i++) {
        if (layouts[i].id === id) {
            layoutOutdoor = layouts[i];
            break;
        }
    }

    if (!layoutOutdoor) {
        return res.send('<p>List not found.</p><a href="/homeListsOutdoor">Back to List</a>');
    }

    res.send(`
        <!doctype html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="stylesheet" href="/editListOutdoor.css">
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
                <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>
                <script src="https://cdn.jsdelivr.net/npm/popper.js@1.12.9/dist/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
                <title>Edit List</title>
            </head>

            <body>
                <div class="center-box">
                    <div>
                        <div>
                            <div>
                                <h1>Edit Outdoor List!</h1>
                                <form action="/editListOutdoor/${layoutOutdoor.id}" method="POST" enctype="multipart/form-data">
                                    <b>Item or Facility:</b> <input name="itemOrfacility" value="${layoutOutdoor.itemOrfacility}" required /> <br><br>
                                    <b>Description:</b> <input name="description" value="${layoutOutdoor.description}" required /> <br><br> 
                                    <b>Comment:</b> <input name="comment" value="${layoutOutdoor.comment}" required /> <br><br>
                                    <b>Priority Level:</b> <select name="priority" required>
                                        <option value="1" ${layoutOutdoor.priority === 1 ? 'selected' : ''}>Priority 1 (Most Priority)</option>
                                        <option value="2" ${layoutOutdoor.priority === 2 ? 'selected' : ''}>Priority 2 (Medium Priority)</option>
                                        <option value="3" ${layoutOutdoor.priority === 3 ? 'selected' : ''}>Priority 3 (Least Priority)</option>
                                    </select> <br><br>
                                    <b>Estimated Cost:</b> <input type="number" name="estimatedCost" value="${layoutOutdoor.estimatedCost}" required /> <br><br> 
                                    <b>Image:</b> <input type="file" name="image" placeholder="image" /> <br><br>
                                    <button type="submit">Update List</button>
                                </form>
                                <p> </p>
                                <a href="/homeListsOutdoor">Back to List</a>
                            </div>
                        </div>
                    </div>
                </div>
            </body>       
    `);
});

// Edit Book POST route
app.post('/editListIndoor/:id', upload.single('image'), (req, res) => {
    const id = parseInt(req.params.id);
    const sessionUser = getCurrentUser(req);
    if (!sessionUser) return res.redirect('/');
    // Reload user from file to get latest data
    const user = getUser(sessionUser.username);
    if (!user) return res.redirect('/');
    const layouts = user.layoutsIndoor || [];
    for (let i = 0; i < layouts.length; i++) {
        if (layouts[i].id === id) {
            layouts[i].itemOrfacility = req.body.itemOrfacility;
            layouts[i].description = req.body.description;
            layouts[i].comment = req.body.comment;
            layouts[i].priority = parseInt(req.body.priority) || 1;
            layouts[i].estimatedCost = parseInt(req.body.estimatedCost) || 1000;
            if (req.file) {
                layouts[i].image = req.file.filename;
            }
            break;
        }
    }
    user.layoutsIndoor = layouts;
    saveUser(user);
    res.redirect('/homeListsIndoor');
});

app.post('/editListOutdoor/:id', upload.single('image'), (req, res) => {
    const id = parseInt(req.params.id);
    const sessionUser = getCurrentUser(req);
    if (!sessionUser) return res.redirect('/');
    // Reload user from file to get latest data
    const user = getUser(sessionUser.username);
    if (!user) return res.redirect('/');
    const layouts = user.layoutsOutdoor || [];
    for (let i = 0; i < layouts.length; i++) {
        if (layouts[i].id === id) {
            layouts[i].itemOrfacility = req.body.itemOrfacility;
            layouts[i].description = req.body.description;
            layouts[i].comment = req.body.comment;
            layouts[i].priority = parseInt(req.body.priority) || 1;
            layouts[i].estimatedCost = parseInt(req.body.estimatedCost) || 1000;
            if (req.file) {
                layouts[i].image = req.file.filename;
            }
            break;
        }
    }
    user.layoutsOutdoor = layouts;
    saveUser(user);
    res.redirect('/homeListsOutdoor');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});