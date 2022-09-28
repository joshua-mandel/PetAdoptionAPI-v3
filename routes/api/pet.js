const debug = require('debug')('app:routes:api:pet');
const debugError = require('debug')('app:error');
const express = require('express');
const { nanoid } = require('nanoid');
const dbModule = require('../../database');
const { newId } = require('../../database');

//create a router
const router = express.Router();

//define routes
router.get('/api/pet/list', async (req, res, next) => {
  try {
    const pets = await dbModule.findAllPets();
    res.json(pets);
  } catch (err) {
    next(err);
  }
});

router.get('/api/pet/:petId', async (req, res, next) => {
  try {
    const petId = newId(req.params.petId);
    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: `${petId} not found!` });
    } else {
      res.json(pet);
    }
  } catch (err) {
    next(err);
  }

  // const petId = req.params.petId;
  // const foundPet = petsArray.find((x) => x._id == petId);
  // if (!foundPet) {
  //   res.status(404).json({ error: 'Pet Not Found' });
  // } else {
  //   res.json(foundPet);
  // }
});
//create
router.put('/api/pet/new', async (req, res, next) => {
  try {
    const pet = {
      _id: newId(),
      species: req.body.species,
      name: req.body.name,
      age: parseInt(req.body.age),
      gender: req.body.gender,
    };

    //validation
    if (!pet.species) {
      res.status(400).json({ error: 'Species required' });
    } else if (!pet.name) {
      res.status(400).json({ error: 'Name required' });
    } else if (!pet.gender) {
      res.status(400).json({ error: 'Gender required' });
    } else if (!pet.age) {
      res.status(400).json({ error: 'Age required' });
    } else {
      await dbModule.insertOnePet(pet);
      res.json({ message: 'pet created!' });
      // petsArray.push(pet);
      // res.json(pet);
    }
  } catch (err) {
    next(err);
  }
});

//update
router.put('/api/pet/:petId', async (req, res, next) => {
  try {
    const petId = newId(req.params.petId);
    const update = req.body;
    debug(`update pet ${petId}`, update);

    const pet = await dbModule.findPetById(petId);
    if (!pet) {
      res.status(404).json({ error: `Pet ${petId} not found` });
    } else {
      await dbModule.updateOnePet(petId, update);
      res.json({ message: `Pet ${petId} update.` });
    }
  } catch (err) {
    next(err);
  }
  // const pet = petsArray.find((x) => x._id == petId);
  // if (!pet) {
  //   res.status(404).json({ error: 'Pet Not Found' });
  // } else {
  //   if (species != undefined) {
  //     pet.species = species;
  //   }
  //   if (name != undefined) {
  //     pet.name = name;
  //   }
  //   if (age != undefined) {
  //     pet.age = parseInt(age);
  //   }
  //   if (gender != undefined) {
  //     pet.gender = gender;
  //   }
  //   pet.lastUpdated = new Date();
  //   res.json(pet);
  // }
});

//delete
router.delete('/api/pet/:petId', async (req, res, next) => {
  try {
    const petId = newId(req.params.petId);
    debug(`delete pet ${petId}`);
    const pet = await dbModule.findPetById(petId);

    if (!pet) {
      res.status(404).json({ error: `Pet ${petId} not found` });
    } else {
      await dbModule.deleteOnePet(petId);
      res.json({ message: `Pet ${petId} deleted.` });
    }
  } catch (err) {
    next(err);
  }
});

//export router
module.exports = router;
