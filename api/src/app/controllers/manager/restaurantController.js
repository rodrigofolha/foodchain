const Restaurant = require('../../models/Restaurant');
const Yup = require('yup');

module.exports = {
  async index(req, res) {
    const restaurant_id = req.userId;

    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id },
      attributes: {
        exclude: ['password_hash']
      }
    });

    return res.json(restaurant);
  },

  async store(req, res) {
    const restaurant_id = req.userId;
    
    const schema = Yup.object().shape({
      name: Yup.string(),
      email: Yup.string().email(),
      password: Yup.string().min(6),
      restaurant_name: Yup.string(),
      restaurant_address: Yup.string(),
      restaurant_city: Yup.string(),
      culinary: Yup.string(),
      latitude: Yup.number(),
      longitude: Yup.number(),
      spend_public_key: Yup.string(),
      view_public_key: Yup.string(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.json({ error: 'Form validation failed'});
    }

    const {
      name,
      email,
      password,
      restaurant_name,
      restaurant_address,
      restaurant_city,
      culinary,
      latitude,
      longitude,
      spend_public_key,
      view_public_key
    } = req.body;


    const restaurant = await Restaurant.findOne({
      where: { id: restaurant_id }
    });

    const updateRestaurant = await restaurant.update({
      name,
      email,
      password,
      restaurant_name,
      restaurant_address,
      restaurant_city,
      culinary,
      latitude,
      longitude,
      spend_public_key,
      view_public_key,
    });
    
    return res.json(updateRestaurant);
  }
}