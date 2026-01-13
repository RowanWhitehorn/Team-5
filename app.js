const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

let layoutsIndoor = [
    {id: 1, 
    itemOrfacility: 'Library Room', 
    description: 'Several rows of bookshelves that could fit all my books with a rolling ladder.',
    comment: 'I hope my kids will love reading too.',
    image: 'Bookshelves.jpg'},
    {id: 2, 
    itemOrfacility: 'Curved Staircase', 
    description: 'Curved staircase made out of marble.',
    comment: 'So that when I go down the stairs and have a good outfit on, I would look extra.',
    image: 'Staircase.jpg'},
    {id: 3, 
    itemOrfacility: 'Huge Windows', 
    description: 'Huge windows that have a beautiful scenary and bright light that can come through.',
    comment: 'I want my house to have good and natural lighting.',
    image: 'Windows.jpg'}
];

let layoutsOutdoor = [
    {id: 1, 
    itemOrfacility: 'Green House', 
    description: 'Varity of flowers and fruits will be grown in there.',
    comment: 'I hope I will have a green thumb.',
    image: 'Green House.jpg'},
    {id: 2, 
    itemOrfacility: 'Water Fountain', 
    description: '"She told me that she loved me by the water fountain" - Water Fountain by Alec Benjamin.',
    comment: 'I would grow some water plants there.',
    image: 'Water Fountain.jpg'},
    {id: 3, 
    itemOrfacility: 'Gazebo', 
    description: 'To read in there while also admiring my surroundings.',
    comment: 'Why not? I want it.',
    image: 'Gazebo.jpg'}
];

app.use(express.static('css'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/html/coverpage.html");
});

app.get('/selectLocation', (req, res) => {
    res.sendFile(__dirname + "/html/location.html")
});

app.get('/homeListsIndoor', (req, res) => {
    let list = '';
    for (let i = 0; i < layoutsIndoor.length; i++) {
        list += 
        `<li>
            <h2><b>${layoutsIndoor[i].itemOrfacility}</b></h2>
            <b>Description:</b>
            <p>${layoutsIndoor[i].description}</p>
            <b>Comment:</b>
            <p>${layoutsIndoor[i].comment}</p>
            <b>Image:</b>
            <p><img src="${layoutsIndoor[i].image}" class="rounded" width="200" height="200"></p>
            <a href="/editListIndoor/${layoutsIndoor[i].id}">Edit</a>
            <p> </p>
            <form action="/deleteListIndoor/${layoutsIndoor[i].id}" method="POST">
                 <button type="submit">Delete</button>
            </form>
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
            </div>
            <ul>${list}</ul>
            <a class="btn btn-primary m-2" id="homeBtn" href='/addListIndoor'>Add a List</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/'>Back to Home</a>
        </body>
        </html>`);
});

app.get('/homeListsOutdoor', (req, res) => {
    let list = '';
    for (let i = 0; i < layoutsOutdoor.length; i++) {
        list += 
        `<li>
            <h2><b>${layoutsOutdoor[i].itemOrfacility}</b></h2>
            <b>Description:</b>
            <p>${layoutsOutdoor[i].description}</p>
            <b>Comment:</b>
            <p>${layoutsOutdoor[i].comment}</p>
            <b>Image:</b>
            <p><img src="${layoutsOutdoor[i].image}" class="rounded" width="200" height="200"></p>
            <a href="/editListOutdoor/${layoutsOutdoor[i].id}">Edit</a>
            <p> </p>
            <form action="/deleteListOutdoor/${layoutsOutdoor[i].id}" method="POST">
                 <button type="submit">Delete</button>
            </form>
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
            </div>
            <ul>${list}</ul>
            <a class="btn btn-primary m-2" id="homeBtn" href='/addListOutdoor'>Add a List</a>
            <a class="btn btn-primary m-2" id="homeBtn" href='/'>Back to Home</a>
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

app.post('/addListIndoor', (req, res) => {
    const newId = layoutsIndoor.length +1;
    layoutsIndoor.push({ 
        id: newId, 
        itemOrfacility: req.body.itemOrfacility, 
        description: req.body.description, 
        comment: req.body.comment,
        image: req.body.image
    });
    res.redirect('/homeListsIndoor');
});

app.post('/addListOutdoor', (req, res) => {
    const newId = layoutsOutdoor.length +1;
    layoutsOutdoor.push({ 
        id: newId, 
        itemOrfacility: req.body.itemOrfacility, 
        description: req.body.description, 
        comment: req.body.comment,
        image: req.body.image
    });
    res.redirect('/homeListsOutdoor');
});

app.post('/deleteListIndoor/:id', (req, res) => {
    const id = parseInt(req.params.id);
    layoutsIndoor = layoutsIndoor.filter(b => b.id !== id);
    res.redirect('/homeListsIndoor');
});

app.post('/deleteListOutdoor/:id', (req, res) => {
    const id = parseInt(req.params.id);
    layoutsOutdoor = layoutsOutdoor.filter(b => b.id !== id);
    res.redirect('/homeListsOutdoor');
});


// Edit Book Form Page
app.get('/editListIndoor/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let layoutIndoor = null;

    for (let i = 0; i < layoutsIndoor.length; i++) {
        if (layoutsIndoor[i].id === id) {
            layoutIndoor = layoutsIndoor[i];
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
                                <form action="/editListIndoor/${layoutIndoor.id}" method="POST">
                                    <b>Item or Facility:</b> <input name="itemOrfacility" value="${layoutIndoor.itemOrfacility}" required /> <br><br>
                                    <b>Description:</b> <input name="description" value="${layoutIndoor.description}" required /> <br><br> 
                                    <b>Comment:</b> <input name="comment" value="${layoutIndoor.comment}" required /> <br><br> 
                                    <b>Image:</b> <input type="file" name="image" placeholder="image" value="${layoutIndoor.image}" required /> <br><br>
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
    let layoutOutdoor = null;

    for (let i = 0; i < layoutsOutdoor.length; i++) {
        if (layoutsOutdoor[i].id === id) {
            layoutOutdoor = layoutsOutdoor[i];
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
                                <form action="/editListOutdoor/${layoutOutdoor.id}" method="POST">
                                    <b>Item or Facility:</b> <input name="itemOrfacility" value="${layoutOutdoor.itemOrfacility}" required /> <br><br>
                                    <b>Description:</b> <input name="description" value="${layoutOutdoor.description}" required /> <br><br> 
                                    <b>Comment:</b> <input name="comment" value="${layoutOutdoor.comment}" required /> <br><br> 
                                    <b>Image:</b> <input type="file" name="image" placeholder="image" value="${layoutOutdoor.image}" required /> <br><br>
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
app.post('/editListIndoor/:id', (req, res) => {
    const id = parseInt(req.params.id);

    for (let i = 0; i < layoutsIndoor.length; i++) {
        if (layoutsIndoor[i].id === id) {
            layoutsIndoor[i].itemOrfacility = req.body.itemOrfacility;
            layoutsIndoor[i].description = req.body.description;
            layoutsIndoor[i].comment = req.body.comment;
            layoutsIndoor[i].image = req.body.image;
            break;
        }
    }

    res.redirect('/homeListsIndoor');
});

app.post('/editListOutdoor/:id', (req, res) => {
    const id = parseInt(req.params.id);

    for (let i = 0; i < layoutsOutdoor.length; i++) {
        if (layoutsOutdoor[i].id === id) {
            layoutsOutdoor[i].itemOrfacility = req.body.itemOrfacility;
            layoutsOutdoor[i].description = req.body.description;
            layoutsOutdoor[i].comment = req.body.comment;
            layoutsOutdoor[i].image = req.body.image;
            break;
        }
    }

    res.redirect('/homeListsOutdoor');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});