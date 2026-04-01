const plainTextPassword = "password";

const generateHash = async () => {
    const hash = await Bun.password.hash(plainTextPassword);
    console.log("Your database hash is:");
    console.log(hash);
};

generateHash();