const Deliveryman = require('../../models/Deliveryman');

const Yup = require('yup');

module.exports = {
  async store(req, res) {
    const schema = Yup.object().shape({
      name: Yup.string().required(),
      email: Yup.string().email().required(),
      password: Yup.string().min(6).required(),
      transport: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.json({ error: 'Form validation failed' });
    }

    const { 
      email,
      name,
      password,
      transport
    } = req.body;
    
    if (await Deliveryman.findOne({ where: { email }})) {
      return res.status(400).json({ error: 'This email is already registered '});
    }
    
    const deliveryman = await Deliveryman.create({
      name,
      email,
      password,
      transport
    });

    return res.json(deliveryman);
  }
}