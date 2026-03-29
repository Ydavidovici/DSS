import bcrypt from "bcrypt";

const plainTextPassword = "password";
const saltRounds = 10;

const generateHash = async () => {
    const hash = await bcrypt.hash(plainTextPassword, saltRounds);
    console.log("Your database hash is:");
    console.log(hash);
};

generateHash();