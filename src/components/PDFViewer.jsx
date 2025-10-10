import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { reconstructPDFFromChunks, getPDFMetadata } from "../utils/pdfChunkedStorage";

export default function PDFViewer() {
  const { pdfId } = useParams();
  const navigate = useNavigate();
  const [pdfData, setPdfData] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPDF();
  }, [pdfId]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📄 Loading PDF...', { pdfId });

      // Get metadata first
      console.log('📋 Getting PDF metadata...');
      const metadataResult = await getPDFMetadata(pdfId);
      console.log('✅ Metadata loaded:', metadataResult);
      setMetadata(metadataResult);

      // Then reconstruct PDF
      console.log('🔧 Reconstructing PDF from chunks...');
      const pdfDataResult = await reconstructPDFFromChunks(pdfId);
      console.log('✅ PDF reconstructed, size:', pdfDataResult?.length || 'unknown');

      if (pdfDataResult && pdfDataResult.startsWith('data:application/pdf')) {
        setPdfData(pdfDataResult);
        console.log('✅ PDF data set successfully');
      } else {
        throw new Error('Invalid PDF data format');
      }

    } catch (err) {
      console.error('❌ Error loading PDF:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (pdfData && metadata) {
      const link = document.createElement('a');
      link.href = pdfData;
      link.download = metadata.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading PDF...</h2>
          <p className="text-gray-600">Reconstructing PDF from chunks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Cannot Load PDF</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={loadPDF}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/dashboard/pdf-manager')}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Back to PDF Manager
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      {/* Header */}
      <div className="bg-white border-b w-full">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard/pdf-manager')}
                className="inline-flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <div>
                <h1 className="text-lg font-medium text-gray-900">
                  {metadata?.invoiceId || 'Loading...'}
                </h1>
                <p className="text-sm text-gray-500">
                  {metadata?.type === 'tax' ? 'Tax Invoice' : 'Proforma Invoice'}
                </p>
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Download
            </button>
          </div>
        </div>
      </div>

      {/* PDF Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-4 w-full">
        <div className="w-full max-w-sm mx-auto">
          {pdfData ? (
            <>
              <div className="bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="p-3">
                  <div className="flex justify-center items-center bg-gray-50 p-3 rounded">
                    <iframe
                      src={pdfData}
                      className="border border-gray-300 rounded a4-preview"
                      title="PDF Viewer"
                      style={{
                        width: '320px', // Significantly reduced width (about 54% of original)
                        height: '440px', // Significantly reduced height (about 52% of original)
                        minWidth: '280px',
                        minHeight: '350px',
                        maxWidth: '75vw',
                        maxHeight: '55vh',
                        objectFit: 'contain',
                        backgroundColor: 'white'
                      }}
                      onError={() => {
                        console.error('PDF iframe failed to load');
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t bg-gray-50 rounded-b-lg text-center mt-3">
                <p className="text-sm text-gray-600">
                  Having trouble viewing?
                  <button
                    onClick={handleDownload}
                    className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Download PDF instead
                  </button>
                </p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-12 text-center">
              <div className="text-gray-500">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Loading PDF...</h3>
                <p className="text-gray-600">Reconstructing document from chunks...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
