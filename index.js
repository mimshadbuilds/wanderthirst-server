import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'
import cors from 'cors'
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const proxyToken = async(req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if(!authHeader){
        return res.status(401).send({msg:'Unauthorized!'})
    }

    const token = authHeader.split(" ")[1]

    if(!token){
        return res.status(401).send({msg:'Unauthorized!'})
    }
    
    try {
        const JWKS = createRemoteJWKSet(new URL('http://localhost:3000/api/auth/jwks'));
        const { payload } = await jwtVerify(token, JWKS)
        next();
    } catch (error){
        console.error('Token validation failed:', error)
        throw error
    }
}

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("Successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("wanderthirstDB");

const destinationsCollection = db.collection('destinations');
const bookingCollection = db.collection('bookings')

app.post('/add-destination', proxyToken, async(req, res) => {
    const data = req.body;
    const result = await destinationsCollection.insertOne(data);
    res.send(result);
})

app.get('/destinations', async(req, res) => {
    const result = await destinationsCollection.find().toArray()
    res.send(result);
})

app.get('/destinations/:id', proxyToken, async(req, res) => {
    const { id } = req.params;
    const result = await destinationsCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
})

app.patch('/destinations/:id', proxyToken, async(req, res) => {
    const { id } = req.params;
    const updatedData = req.body;

    const result = await destinationsCollection.updateOne({
        _id: new ObjectId(id)
    }, { $set: updatedData }
)
    res.json(result);
})

app.delete('/destinations/:id', proxyToken, async(req, res) => {
    const { id } = req.params;
    const result = await destinationsCollection.deleteOne({
        _id: new ObjectId(id)
    })
    res.json(result);
})

app.post('/bookings', async(req, res) => {
    const bookingData = req.body;
    const result = await bookingCollection.insertOne(bookingData);
    res.send(result);
})

//http://localhost:5000/featured-destinations
app.get('/featured-destinations', async(req, res) => {
    const result = await destinationsCollection.find().limit(5).toArray()
    res.send(result);
})

app.get('/my-bookings/:email', proxyToken, async(req, res) => {
    const { email } = req.params;
    const result = await bookingCollection.find({ email: email }).toArray()
    res.send(result);
})

app.delete('/my-bookings/:id', async (req, res) => {
    const { id } = req.params;

    const matchingIds = ObjectId.isValid(id) ? [id, new ObjectId(id)] : [id];
    const result = await bookingCollection.deleteOne({ _id: { $in: matchingIds } });

    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(result);
});

app.listen(port, () => {
    console.log(`Wanderthrist server is running on port ${port}`)
})
