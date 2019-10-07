const MONGO_URI = 'mongodb://exercisetracker:exercisetracker@server.andreibuntsev.com:27017/exercisetracker';
const MongoClient = require('mongodb').MongoClient;
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const MONGO_CLIENT_OPTIONS = { useUnifiedTopology: true, useNewUrlParser: true };
const MONGO_DB_NAME = 'exercisetracker';



app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.get('/api/exercise/users', (req, res) => {
  MongoClient.connect(MONGO_URI, MONGO_CLIENT_OPTIONS, async function (err, client) {
    if (err) {
      console.error(err);
    } else {
      try {
        const db = client.db(MONGO_DB_NAME);
        let users = await db.collection('users').find().toArray();
        res.json(users)
      }
      catch (e) {
        console.error(e);
      }

      client.close();
    }
  });
});


app.post('/api/exercise/new-user', (req, res) => {
  const userName = req.body.username;
  if (!userName) {
    res.send('Path `username` is required.');
    return;
  }

  MongoClient.connect(MONGO_URI, MONGO_CLIENT_OPTIONS, async function (err, client) {
    if (err) {
      console.error(err);
    } else {
      try {
        const db = client.db(MONGO_DB_NAME);
        let count = await db.collection('users').find({ username: userName }).count();
        if (count > 0) {
          //User already exists
          res.send('username already taken');
          return;
        } else {
          //Insert new user
          await db.collection('users').insertOne({ username: userName });
          let newUser = await db.collection('users').find({ username: userName }).next();
          res.json(newUser)
        }
      }
      catch (e) {
        console.error(e);
      }

      client.close();
    }
  });
});





// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 10719, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
