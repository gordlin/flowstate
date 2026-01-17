import {useEffect, useState} from 'react'
import './App.css'

import './App.css'

function App() {
    const [isActive, setIsActive] = useState(false);
    const [currentUrl, setCurrentUrl] = useState<string>('')

    // Get current tab URL on component mount
    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url) {
                setCurrentUrl(tabs[0].url)
            }
        })
    }, [])

    // Check if split screen is already active
    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: 'getSplitScreenStatus' },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            // Content script might not be ready
                            console.log('Content script not ready yet:', chrome.runtime.lastError.message)
                            return
                        }
                        if (response?.active !== undefined) {
                            setIsActive(response.active)
                        }
                    }
                )
            }
        })
    }, [])

    const handleActivateSplitScreen = () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0].id){
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    {action: 'activateSplitScreen' },
                    (response) => {
                        if(response?.success){
                            setIsActive(true);
                        }
                    }
                )
            }
        })
    }

    const handleDeactivateSplitScreen = () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0].id){
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    {action: 'deactivateSplitScreen' },
                    (response) => {
                        if(response?.success){
                            setIsActive(false);
                        }
                    }
                )
            }
        })
    }

    const handleRefreshPage = () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if(tabs[0]?.id){
                chrome.tabs.reload(tabs[0].id)
                setIsActive(false);
            }
        })
    }

    const isSupportedPage = function(){
        if(!currentUrl){return true;}
        return !currentUrl.startsWith('chrome://') &&
                !currentUrl.startsWith('chrome-extension://') &&
                !currentUrl.startsWith('about:')
    }

    //pass everything to up component
    return(
        <div className="container">
            <div className="header">
                <h1>Flowstate</h1>
                <p className="tagline">Adaptive Accessibility Browser</p>
            </div>

            <div className="current-site">
                <span className="site-label">Current site:</span>
                <div className="site-url">
                    {currentUrl ?
                        new URL(currentUrl).hostname || currentUrl.substring(0, 50) + '...'
                        : 'Loading...'}
                </div>
            </div>

            <div className="controls">
                {!isActive ? (
                    <button
                        className={`activate-btn ${!isSupportedPage() ? 'disabled' : ''}`}
                        onClick={handleActivateSplitScreen}
                        disabled={!isSupportedPage()}
                    >
                        <span className="btn-icon">🚀</span>
                        <span className="btn-text">Activate Split Screen</span>
                    </button>
                ) : (
                    <div className="active-controls">
                        <button
                            className="deactivate-btn"
                            onClick={handleDeactivateSplitScreen}
                        >
                            <span className="btn-icon">❌</span>
                            <span className="btn-text">Close Split Screen</span>
                        </button>
                        <button
                            className="refresh-btn"
                            onClick={handleRefreshPage}
                        >
                            <span className="btn-icon">↻</span>
                            <span className="btn-text">Refresh Page</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="status-indicator">
                <div className={`status-dot ${isActive ? 'active' : 'inactive'}`}></div>
                <span className="status-text">
                    {isActive ? 'Split screen is ACTIVE' : 'Split screen is INACTIVE'}
                </span>
            </div>

            <div className="info-box">
                <h3>📋 What happens when activated:</h3>
                <ul>
                    <li>📏 <strong>Left side:</strong> Original website (50% width)</li>
                    <li>📝 <strong>Right side:</strong> Pathfinder panel (blank for now)</li>
                    <li>🎯 <strong>Future features:</strong> AI simplification, step-by-step guidance</li>
                </ul>

                {!isSupportedPage() && (
                    <div className="warning">
                        ⚠️ Split screen not available on this page type
                    </div>
                )}
            </div>

            <div className="tips">
                <h4>💡 Tips:</h4>
                <p>• Click the "Close Split Screen" button in the right panel to exit</p>
                <p>• Use "Refresh Page" if the page gets stuck</p>
                <p>• Works on most websites except browser internal pages</p>
            </div>

            <div className="footer">
                <div className="version">v0.1.0</div>
                <div className="help">
                    <a href="#" onClick={(e) => {
                        e.preventDefault()
                        chrome.tabs.create({ url: 'https://github.com/yourusername/pathfinder' })
                    }}>
                        Need help?
                    </a>
                </div>
            </div>
        </div>
    );
}

//just to make more organized
// const browserHTML = function(){
//     return (
//         <div className="container">
//             <div className="header">
//                 <h1>🧭 Pathfinder</h1>
//                 <p className="tagline">Adaptive Accessibility Browser</p>
//             </div>
//
//             <div className="current-site">
//                 <span className="site-label">Current site:</span>
//                 <div className="site-url">{currentUrl || 'Loading...'}</div>
//             </div>
//
//             <div className="controls">
//                 {!isActive ? (
//                     <button
//                         className={`activate-btn ${!isSupportedPage() ? 'disabled' : ''}`}
//                         onClick={handleActivateSplitScreen}
//                         disabled={!isSupportedPage()}
//                     >
//                         <span className="btn-icon">🚀</span>
//                         <span className="btn-text">Activate Split Screen</span>
//                     </button>
//                 ) : (
//                     <div className="active-controls">
//                         <button
//                             className="deactivate-btn"
//                             onClick={handleDeactivateSplitScreen}
//                         >
//                             <span className="btn-icon">❌</span>
//                             <span className="btn-text">Close Split Screen</span>
//                         </button>
//                         <button
//                             className="refresh-btn"
//                             onClick={handleRefreshPage}
//                         >
//                             <span className="btn-icon">↻</span>
//                             <span className="btn-text">Refresh Page</span>
//                         </button>
//                     </div>
//                 )}
//             </div>
//
//             <div className="status-indicator">
//                 <div className={`status-dot ${isActive ? 'active' : 'inactive'}`}></div>
//                 <span className="status-text">
//           {isActive ? 'Split screen is ACTIVE' : 'Split screen is INACTIVE'}
//         </span>
//             </div>
//
//             <div className="info-box">
//                 <h3>📋 What happens when activated:</h3>
//                 <ul>
//                     <li>📏 <strong>Left side:</strong> Original website (50% width)</li>
//                     <li>📝 <strong>Right side:</strong> Pathfinder panel (blank for now)</li>
//                     <li>🎯 <strong>Future features:</strong> AI simplification, step-by-step guidance</li>
//                 </ul>
//
//                 {!isSupportedPage() && (
//                     <div className="warning">
//                         ⚠️ Split screen not available on this page type
//                     </div>
//                 )}
//             </div>
//
//             <div className="tips">
//                 <h4>💡 Tips:</h4>
//                 <p>• Click the "Close Split Screen" button in the right panel to exit</p>
//                 <p>• Use "Refresh Page" if the page gets stuck</p>
//                 <p>• Works on most websites except browser internal pages</p>
//             </div>
//
//             <div className="footer">
//                 <div className="version">v0.1.0</div>
//                 <div className="help">
//                     <a href="#" onClick={(e) => {
//                         e.preventDefault()
//                         chrome.tabs.create({ url: 'https://github.com/yourusername/pathfinder' })
//                     }}>
//                         Need help?
//                     </a>
//                 </div>
//             </div>
//         </div>
//     )
//
// }


export default App
