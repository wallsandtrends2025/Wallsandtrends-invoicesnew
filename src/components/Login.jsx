import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { FiLogIn } from "react-icons/fi";

// ✅ Import image from src/assets
import bg from "../assets/login-bg.png"; // adjust relative path if needed

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard/home");
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: `url(${bg})` }} // ✅ now works with import
    >
     

      {/* login card */}
      <form
        onSubmit={handleLogin}
        className="
          relative z-10 w-[420px] max-w-[92vw]
          rounded-[28px]
          bg-gradient-to-b from-[#eaf4fb] to-white
          shadow-[0_18px_45px_rgba(0,0,0,0.18)]
          px-12 py-10 text-center
          login-form
        "
      >
        {/* top small square icon */}
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border-black/10 display-block
  mt-[0] mb-[0] ml-[auto] mr-[auto] w-[100%]">
         
         <FiLogIn size={35} className="text-gray-700 bg-[#ffffff] shadow-sm p-[10px] border-curve justify-center" />

        </div>

        <h2 className="mb-6 text-[25px] font-semibold text-[#2b2b2b]">
          Welcome back!
        </h2>

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {/* Email */}
        <div className="mb-4 flex h-11 items-center rounded-full border border-[#383838] bg-white px-4  pl-[20px] pr-[20px]">
          <FaEnvelope className="mr-[10px] text-gray-500" size={18} />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent text-[18px] text-gray-700 placeholder:text-gray-400 outline-none border-none"
          />
        </div>

        {/* Password */}
        <div className="mb-6 flex h-11 items-center rounded-full border border-[#383838] bg-white px-4 pl-[20px] pr-[20px]">
          <FaLock className="mr-[10px] text-gray-500" size={18} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-transparent text-[18px] text-gray-700 placeholder:text-gray-400 outline-none border-none"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          className="h-11 w-full rounded-full bg-[#2f2f2f] text-[#ffffff] text-[18px] font-medium hover:bg-black transition-colors h-[50px] cursor-pointer"
        >
          Log in
        </button>
      </form>
    </div>
  );
}
