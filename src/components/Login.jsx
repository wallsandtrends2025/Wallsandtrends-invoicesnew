import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { FiLogIn } from "react-icons/fi";
import { authService } from "../utils/authService.jsx";

// ✅ Import image from src/assets
import bg from "../assets/login-bg.png"; // adjust relative path if needed

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await authService.signIn(email, password);
      console.log('🔐 Login successful - proceeding to dashboard');
      navigate("/dashboard/home");
    } catch (err) {
      const errorMessage = err.message;

      if (errorMessage.includes('pending admin approval')) {
        setError('Your account is pending administrator approval. An email notification has been sent to administrators. Please try again later or contact support.');
        return;
      } else if (errorMessage.includes('Account is deactivated')) {
        setError('Your account has been deactivated. Please contact an administrator for assistance.');
        return;
      } else {
        setError(errorMessage || "Invalid credentials. Please try again.");
      }
    } finally {
      setLoading(false);
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

        {error && (
          <div className="mb-4 p-4 rounded-lg border-l-4 border-red-500 bg-red-50">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                {error.includes('pending admin approval') && (
                  <p className="text-xs text-red-600 mt-1">
                    Please wait for administrator approval. You will receive an email once approved.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Email */}
        <div className="mb-4 flex h-11 items-center rounded-full border border-[#383838] bg-white px-4  pl-[20px] pr-[20px]">
          <FaEnvelope className="mr-[10px] text-gray-500" size={18} />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full bg-transparent text-[18px] text-gray-700 placeholder:text-gray-400 outline-none border-none disabled:opacity-50"
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
            disabled={loading}
            className="w-full bg-transparent text-[18px] text-gray-700 placeholder:text-gray-400 outline-none border-none disabled:opacity-50"
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-[#2f2f2f] text-[#ffffff] text-[18px] font-medium hover:bg-black transition-colors h-[50px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
