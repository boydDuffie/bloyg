import express, { json, urlencoded } from 'express';
import { MongoClient } from 'mongodb';
import path from 'path';
// bodyParser is deprecated, so we won't be using this:
// import bodyParser from 'body-parser';

// define the app object using express
const app = express();

app.use(express.static(path.join(__dirname, '/build')));

// bodyParser is deprecated now, so instead of this:
// app.use(bodyParser.json());
// we'll use this:
app.use(json()); //Used to parse JSON bodies
app.use(urlencoded({ extended: true })); //Used to parse URL-encoded bodies

// creating a function to handle the db setup and tear-down using a callback and the response object
const withDB = async (res, operations) => {
  try {
    // establish the client from MongoClient
    // useNewUrlParser must be set to true for this to work properly
    const client = await MongoClient.connect('mongodb://localhost:27017', {
      useNewUrlParser: true,
    });

    // get the proper db from the client
    const db = client.db('my-blog');

    // perform whatever specific operations are needed for this instance
    await operations(db);

    // close out the connection to the client when complete
    client.close();
  } catch (error) {
    //   if something went wrong, send a response of 500 (internal server error) saying what the error was
    res.status(500).json({ message: 'Error connecting to db', error });
  }
};

// GET ARTICLE endpoint (async callback because db querying is promise-based)
app.get('/api/articles/:name', async (req, res) => {
  withDB(res, async (db) => {
    const articleName = req.params.name;

    // using the db's collection() method we can get the articles collection and search for our proper document
    // findOne() will get the document with the name matching the one found in the url params
    const articleInfo = await db
      .collection('articles')
      .findOne({ name: articleName });

    //   once the proper article has been found, we'll send it to the client in a response object
    res.status(200).json(articleInfo);
  });
});

// POST UPVOTE endpoint
app.post('/api/articles/:name/upvote', async (req, res) => {
  withDB(res, async (db) => {
    // pulling the articleName from the url params is one way of getting info from the request
    // this alleviates the request from needing the name in its body
    const articleName = req.params.name;

    // Next find our article in the db
    const articleInfo = await db
      .collection('articles')
      .findOne({ name: articleName });
    //   Then update that article's upvote value
    await db.collection('articles').updateOne(
      { name: articleName },
      {
        $set: {
          upvotes: articleInfo.upvotes + 1,
        },
      }
    );
    // Lastly we need to get the updated article
    const updatedArticleInfo = await db
      .collection('articles')
      .findOne({ name: articleName });

    //   Send back to the client a success message and the updated article object
    res.status(200).json(updatedArticleInfo);
  });
});

// POST COMMENT endpoint
app.post('/api/articles/:name/add-comment', (req, res) => {
  // destructuring the request body, this is some ES6 magic that I forgot existed. So let me explain:
  // since the fields inside the nameless object on the left match the key names of the req.body object EXACTLY,
  // the values transfer over without having to specify anything else.
  // The var names have to be exact matches to the keys though, or else this breaks.
  const { userName, text } = req.body;

  // using url params we can get the name from the url path string and put that into a variable too
  const articleName = req.params.name;

  withDB(res, async (db) => {
    // get the article in question from the db:
    const article = await db
      .collection('articles')
      .findOne({ name: articleName });

    //   update the article's comment value using array spread operator
    await db.collection('articles').updateOne(
      { name: articleName },
      {
        $set: {
          comments: [...article.comments, { userName, text }],
        },
      }
    );

    // get the updated article from the db
    const updatedArticle = await db
      .collection('articles')
      .findOne({ name: articleName });

    //   send the updated article in a success response message
    res.status(200).json(updatedArticle);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/build/index.html'));
});

// Start the server on port 8000
app.listen(8000, () => {
  console.log('listening on port 8000');
});

// to run the server, use 'npx babel-node <path to server>'
// OR get nodemon (npm install --save-dev nodemon) and then run:
// npx nodemon --exec npx babel-node <path to server>
// adding this to the scripts object in package.json helps to make things easier too...
