const AgeGate = ({ onEnter }) => (
  <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center p-6">
    <div className="max-w-md w-full text-center">
      {/* Warning icon */}
      <div className="w-20 h-20 rounded-full bg-red-600/10 border-2 border-red-600/40 flex items-center justify-center mx-auto mb-6">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-red-500">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
      </div>

      {/* Logo */}
      <div className="mb-2 text-[22px] font-black tracking-tight">
        <span className="text-white">LUST</span>
        <span className="text-red-500">BUSTER</span>
      </div>

      <div className="inline-block bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-6 tracking-widest uppercase">
        Adults Only · 18+
      </div>

      <h1 className="text-white text-2xl font-bold mb-3">Age Verification Required</h1>
      <p className="text-gray-400 text-sm leading-relaxed mb-8">
        This website contains adult content intended for individuals who are
        18 years of age or older. By entering, you confirm that you are at
        least 18 years old and consent to viewing such material.
      </p>

      {/* Buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onEnter}
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
        >
          I am 18 or older — Enter
        </button>
        <a
          href="https://www.google.com"
          className="w-full bg-[#1a1a1a] hover:bg-[#272727] text-gray-400 hover:text-white font-medium py-3.5 rounded-xl transition-colors text-base block"
        >
          I am under 18 — Leave
        </a>
      </div>

      <p className="text-gray-600 text-xs mt-6">
        By entering you agree to our terms of service and confirm you are of legal age in your jurisdiction.
      </p>
    </div>
  </div>
);

export default AgeGate;
