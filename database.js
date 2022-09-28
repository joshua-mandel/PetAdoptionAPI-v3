const { MongoClient, ObjectId } = require('mongodb');
const config = require('config');
const debugMain = require('debug')('app:database');

const newId = (str) => ObjectId(str);

let _db = null;
/**
 * Connect to the database
 * @returns Promise<Db>
 */
async function connect() {
  if (!_db) {
    const dbUrl = config.get('db.url');
    const dbName = config.get('db.name');
    const client = await MongoClient.connect(dbUrl);
    _db = client.db(dbName);
    debugMain('Connected');
  }
  return _db;
}

async function ping() {
  const db = await connect();
  await db.command({ ping: 1 });
  debugMain('Ping.');
}

async function findAllPets() {
  // throw new Error('test');
  const db = await connect();
  const pets = await db.collection('pets').find({}).toArray();
  return pets;
}

async function findPetById(petId) {
  const db = await connect();
  const pet = await db.collection('pets').findOne({ _id: { $eq: petId } })
  return pet;
}

async function insertOnePet(pet) {
  const db = await connect();
  await db.collection('pets').insertOne({
    ...pet,
    createdDate: new Date(),
  });
}

async function updateOnePet(petId, update) {
  const db = await connect();
  await db.collection('pets').updateOne(
    {_id: { $eq: petId }},
    {
      $set: {
        ...update,
        lastUpdated: new Date(),
      },
    }
  );
}

async function deleteOnePet(petId, update) {
  const db = await connect();
  await db.collection('pets').deleteOne({ _id: { $eq: petId } });
}

ping();

module.exports = {
  connect,
  ping,
  findAllPets,
  findPetById,
  newId,
  insertOnePet,
  updateOnePet,
  deleteOnePet,
};
