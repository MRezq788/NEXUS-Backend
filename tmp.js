import { doc, collection, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "./firebase"; // Make sure to import your initialized database

// 1. Create a reference to the document containing the array


// 2. Add the new product object to the array
async function addProduct() {
  const userDoc = doc(db, 'users', "warehouse1@nexus.com");
  const orderRef = doc(collection(userDoc, 'orders'), "MxIuQuIy5ILuz0gl5fTm");
  try {
    await updateDoc(orderRef, {
      products: arrayUnion({
        productId: "BaLJxqGZYkOfncjG8zfb",
        quantity: 5,
      })
    });
    console.log("Product successfully added!");
  } catch (error) {
    console.error("Error adding product: ", error);
  }
}

addProduct();