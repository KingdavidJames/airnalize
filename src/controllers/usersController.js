import User from "../models/User.js";
export const getUsers = (req, res) => {
    console.log('response from getUsers');
    const users = [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' },
    ];
    res.status(200).json(users);
};

export const createUser = async (req, res) => {
    const newUser = req.body;  
    let user = new User(newUser); 
    await user.save();  
    res.status(201).json({ status:true,message:'User created successfully', newUser});
};

export const getUserById = (req, res) => {
    const id = req.params.id;
    // let user = User.findOne({username:id});
    const user = { id, name: 'John Doe' };
    res.status(200).json(user); 
}

export const getUser = async (req, res) => {
    const username = req.params.username;
    let user = await User.findOne({username:username});

    if(!user){
        return res.status(404).json({ status:false, message:'User not found' });
    }
    // const user = { id, name: 'John Doe' };
    res.status(200).json({ status:true,message:'User retrived successfully', user}); 
}
