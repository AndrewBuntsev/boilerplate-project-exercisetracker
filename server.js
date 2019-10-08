const MONGO_URI = 'mongodb://exercisetracker:exercisetracker@server.andreibuntsev.com:27017/exercisetracker';
//const MONGO_URI = 'mongodb://localhost:27017/exercisetracker';
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const MONGO_CLIENT_OPTIONS = {
  useUnifiedTopology: true,
  useNewUrlParser: true
};
const MONGO_DB_NAME = 'exercisetracker';

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/api/exercise/users', (req, res) => {
  MongoClient.connect(MONGO_URI, MONGO_CLIENT_OPTIONS, async function(err, client) {
    if (err) {
      console.error(err);
    } else {
      try {
        const db = client.db(MONGO_DB_NAME);
        let users = await db
          .collection('users')
          .find()
          .toArray();
        res.json(users);
      } catch (e) {
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

  MongoClient.connect(MONGO_URI, MONGO_CLIENT_OPTIONS, async function(err, client) {
    if (err) {
      console.error(err);
    } else {
      try {
        const db = client.db(MONGO_DB_NAME);
        let count = await db
          .collection('users')
          .find({ username: userName })
          .count();
        if (count > 0) {
          //User already exists
          res.send('username already taken');
          return;
        } else {
          //Insert new user
          await db.collection('users').insertOne({ username: userName });
          let newUser = await db
            .collection('users')
            .find({ username: userName })
            .next();
          res.json(newUser);
        }
      } catch (e) {
        console.error(e);
      }

      client.close();
    }
  });
});

app.post('/api/exercise/add', (req, res) => {
  if (!req.body.userId) {
    res.send('unknown _id');
    return;
  }

  let objectId;
  try {
    objectId = new ObjectId(req.body.userId);
  } catch (e) {
    res.send('unknown _id');
    return;
  }

  MongoClient.connect(MONGO_URI, MONGO_CLIENT_OPTIONS, async function(err, client) {
    if (err) {
      console.error(err);
    } else {
      try {
        const db = client.db(MONGO_DB_NAME);

        let user = await db.collection('users').findOne({ _id: objectId });

        if (user == null) {
          res.send('unknown _id');
          return;
        }

        if (!req.body.duration) {
          res.send('Path `duration` is required.');
          return;
        }

        if (!req.body.description) {
          res.send('Path `description` is required.');
          return;
        }

        let date = new Date();
        if (req.body.date) {
          date = new Date(req.body.date);
          if (!isValidDate(date)) {
            res.send('Cast to Date failed for value "' + req.body.date + '" at path "date"');
            return;
          }
        }

        await db.collection('exercises').insertOne({ userId: objectId, description: req.body.description, duration: req.body.duration, date: date });
        res.json({
          username: user.username,
          description: req.body.description,
          duration: req.body.duration,
          _id: req.body.userId,
          date: date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).replace(',', '')
        });
      } catch (e) {
        console.error(e);
      }

      client.close();
    }
  });
});

app.get('/api/exercise/log', (req, res) => {
  if (!req.query.userId) {
    res.send('unknown userId');
    return;
  }

  let objectId;
  try {
    objectId = new ObjectId(req.query.userId);
  } catch (e) {
    res.send('unknown userId');
    return;
  }

  MongoClient.connect(MONGO_URI, MONGO_CLIENT_OPTIONS, async function(err, client) {
    if (err) {
      console.error(err);
    } else {
      try {
        const db = client.db(MONGO_DB_NAME);
        let user = await db.collection('users').findOne({ _id: objectId });
        if (user == null) {
          res.send('unknown userId');
          return;
        }

        let exercises = await db
          .collection('exercises')
          .find({ userId: objectId })
          .toArray();

        if (req.query.from) {
          let from = new Date(req.query.from);
          if (isValidDate(from)) {
            exercises = exercises.filter(e => e.date >= from);
          }
        }

        if (req.query.to) {
          let to = new Date(req.query.to);
          if (isValidDate(to)) {
            exercises = exercises.filter(e => e.date <= to);
          }
        }

        if (req.query.limit) {
          let limit = new Number(req.query.limit);
          if (!Number.isNaN(limit)) {
            exercises = exercises.slice(0, limit);
          }
        }

        res.json({
          _id: req.query.userId,
          username: user.username,
          count: exercises.length,
          log: exercises.map(e => ({
            description: e.description,
            duration: e.duration,
            date: e.date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).replace(',', '')
          }))
        });
      } catch (e) {
        console.error(e);
      }

      client.close();
    }
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: 'not found' });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res
    .status(errCode)
    .type('txt')
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 1019, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}
