import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2, Sparkles, AlertCircle, RefreshCw, Download } from 'lucide-react';

export default function App() {
  const [mainImage, setMainImage] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const [mode, setMode] = useState('try-on'); // 'try-on' or 'hold'
  const [resultImage, setResultImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const mainInputRef = useRef(null);
  const productInputRef = useRef(null);

  const handleImageUpload = (e, setImage) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  // Memisahkan MimeType dan Base64 data agar dinamis
  const getMimeAndBase64 = (dataUrl) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const b64 = arr[1];
    return { mime, b64 };
  };

  const generateImageWithRetry = async (payload, maxRetries = 5) => {
   const apiKey = import.meta.env.VITE_GEMINI_API_KEY; // API key disediakan oleh environment
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
    
    let attempt = 0;
    const baseDelays = [1000, 2000, 4000, 8000, 16000];

    while (attempt < maxRetries) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Koneksi API bermasalah (Status: ${response.status})`);
        }

        const data = await response.json();
        
        // Mengekstrak gambar base64 dari respons
        const base64Data = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        
        if (!base64Data) {
           const textResponse = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
           throw new Error(textResponse || "AI gagal menghasilkan gambar. Coba gambar atau mode lain.");
        }

        return `data:image/jpeg;base64,${base64Data}`;

      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        await delay(baseDelays[attempt - 1]);
      }
    }
  };

  const handleGenerate = async () => {
    if (!mainImage || !productImage) {
      setError("Silakan unggah Gambar Utama dan Gambar Produk terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultImage(null);

    try {
      const modePrompt = mode === 'try-on' 
        ? "Edit the first image of the person so they are naturally wearing the clothing or accessory shown in the second image. Ensure realistic fabric wrapping, lighting matching, and correct proportions."
        : "Edit the first image of the person so their hand is holding the product shown in the second image. Make it look highly realistic with correct finger positioning (occlusion) and contact shadows.";

      const prompt = `You are an expert AI photo editor. I am providing two images: the first is the main subject (person), and the second is the product. ${modePrompt} The final output must be photorealistic.`;

      const mainData = getMimeAndBase64(mainImage);
      const prodData = getMimeAndBase64(productImage);

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mainData.mime, data: mainData.b64 } },
              { inlineData: { mimeType: prodData.mime, data: prodData.b64 } }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE"]
        }
      };

      const resultUrl = await generateImageWithRetry(payload);
      setResultImage(resultUrl);

    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (resultImage) {
      const a = document.createElement('a');
      a.href = resultImage;
      a.download = `AI_${mode}_Result.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 flex items-center justify-center gap-3">
            <Sparkles className="text-indigo-600" size={40} />
            AI Try-On & Holder
          </h1>
          <p className="text-md md:text-lg text-gray-600 max-w-2xl mx-auto">
            Unggah foto Anda dan foto produk. AI kami akan menggabungkannya secara realistis agar Anda terlihat memakai atau memegang produk tersebut.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Kolom Kiri: Input Area (Lebar 5/12 di Desktop) */}
          <div className="lg:col-span-5 space-y-6 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-bold border-b border-gray-100 pb-3 mb-4 text-gray-800">1. Unggah Gambar</h2>
              
              <div className="space-y-4">
                {/* Main Image Upload */}
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all h-40 relative overflow-hidden group"
                  onClick={() => mainInputRef.current.click()}
                >
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                    ref={mainInputRef}
                    onChange={(e) => handleImageUpload(e, setMainImage)}
                  />
                  {mainImage ? (
                    <>
                      <img src={mainImage} alt="Main" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white font-medium text-sm">Ganti Gambar Utama</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="text-indigo-400 mb-2" size={32} />
                      <span className="text-sm font-semibold text-gray-700">Gambar Utama (Subjek)</span>
                      <span className="text-xs text-gray-400 mt-1">Orang / Model</span>
                    </>
                  )}
                </div>

                {/* Product Image Upload */}
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all h-40 relative overflow-hidden group"
                  onClick={() => productInputRef.current.click()}
                >
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                    ref={productInputRef}
                    onChange={(e) => handleImageUpload(e, setProductImage)}
                  />
                  {productImage ? (
                    <>
                      <img src={productImage} alt="Product" className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white font-medium text-sm">Ganti Gambar Produk</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="text-indigo-400 mb-2" size={32} />
                      <span className="text-sm font-semibold text-gray-700">Gambar Produk</span>
                      <span className="text-xs text-gray-400 mt-1">Baju / Barang</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Mode Selection */}
            <div>
              <h2 className="text-xl font-bold border-b border-gray-100 pb-3 mb-4 text-gray-800 mt-2">2. Pilih Interaksi</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'try-on' ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-sm' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="mode" value="try-on" checked={mode === 'try-on'} onChange={() => setMode('try-on')} className="hidden" />
                  <span className="font-bold mb-1">👚 Try-On</span>
                  <span className="text-xs text-center opacity-80">Mengenakan produk (Baju/Topi)</span>
                </label>
                <label className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'hold' ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-sm' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="mode" value="hold" checked={mode === 'hold'} onChange={() => setMode('hold')} className="hidden" />
                  <span className="font-bold mb-1">📱 Hold Item</span>
                  <span className="text-xs text-center opacity-80">Memegang produk (Tas/Gadget)</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 text-sm border border-red-100">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button 
              onClick={handleGenerate}
              disabled={isLoading || !mainImage || !productImage}
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md mt-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  Memproses Gambar AI...
                </>
              ) : (
                <>
                  <Sparkles size={22} />
                  Satukan Gambar Sekarang
                </>
              )}
            </button>
          </div>

          {/* Kolom Kanan: Output Area (Lebar 7/12 di Desktop) */}
          <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h2 className="text-xl font-bold text-gray-800">Hasil Render AI</h2>
              
              <div className="flex gap-2">
                {resultImage && (
                  <>
                    <button 
                      onClick={handleDownload} 
                      className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                      title="Unduh Gambar"
                    >
                      <Download size={16} /> Unduh
                    </button>
                    <button 
                      onClick={handleGenerate} 
                      disabled={isLoading} 
                      className="text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors"
                    >
                      <RefreshCw size={16} /> Render Ulang
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-grow flex items-center justify-center bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 relative">
              {isLoading ? (
                <div className="flex flex-col items-center text-indigo-500 gap-4 p-8 text-center">
                  <Loader2 className="animate-spin" size={56} />
                  <div>
                    <p className="font-bold text-lg text-gray-800 mb-1">Sedang Menganalisa...</p>
                    <p className="text-sm text-gray-500">Mendeteksi pose tubuh dan menggabungkan produk. Ini butuh beberapa detik.</p>
                  </div>
                </div>
              ) : resultImage ? (
                <img src={resultImage} alt="AI Generated Result" className="w-full h-full object-contain max-h-[600px]" />
              ) : (
                <div className="text-gray-400 flex flex-col items-center p-8 text-center">
                  <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <Sparkles size={48} className="text-indigo-200" />
                  </div>
                  <p className="font-medium text-gray-600 mb-1">Belum ada gambar yang diproses</p>
                  <p className="text-sm">Unggah gambar di panel kiri dan klik "Satukan Gambar Sekarang"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
        }
