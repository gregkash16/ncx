import Foundation
import Capacitor
import AuthenticationServices

/**
 * Capacitor plugin for Sign in with Apple on iOS
 * Bridges between web view and native ASAuthorizationController
 */
@objc(NCXAppleSignInPlugin)
public class NCXAppleSignInPlugin: CAPPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    var authController: ASAuthorizationController?
    var call: CAPPluginCall?

    @objc func initiateSignIn(_ call: CAPPluginCall) {
        self.call = call

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        authController = ASAuthorizationController(authorizationRequests: [request])
        authController?.delegate = self
        authController?.presentationContextProvider = self

        DispatchQueue.main.async {
            self.authController?.performRequests()
        }
    }

    // MARK: - ASAuthorizationControllerDelegate

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            return
        }

        let fullName = appleIDCredential.fullName
        let email = appleIDCredential.email ?? "unknown@apple.com"

        var nameComponents: [String] = []
        if let givenName = fullName?.givenName {
            nameComponents.append(givenName)
        }
        if let familyName = fullName?.familyName {
            nameComponents.append(familyName)
        }

        let name = nameComponents.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        let finalName = !name.isEmpty ? name : "Apple User"

        // Send result to web view
        let credential: [String: Any] = [
            "name": finalName,
            "email": email,
        ]

        sendToWebView(credential)
        call?.resolve(credential)
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        call?.reject("APPLE_SIGNIN_FAILED", error.localizedDescription)
        notifyWebViewOfError(error.localizedDescription)
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) else {
            return ASPresentationAnchor()
        }
        return window
    }

    // MARK: - Web View Communication

    private func sendToWebView(_ credential: [String: Any]) {
        guard let name = credential["name"] as? String,
              let email = credential["email"] as? String else {
            return
        }

        let jsonString = """
        {"name": "\(name.replacingOccurrences(of: "\"", with: "\\\""))", "email": "\(email.replacingOccurrences(of: "\"", with: "\\\""))"}
        """

        let script = "window.signInWithAppleComplete && window.signInWithAppleComplete(\(jsonString))"

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            self.evaluateJavaScript(script)
        }
    }

    private func notifyWebViewOfError(_ message: String) {
        let escapedMessage = message.replacingOccurrences(of: "\"", with: "\\\"")
        let script = "window.signInWithAppleError && window.signInWithAppleError('\(escapedMessage)')"
        evaluateJavaScript(script)
    }

    private func evaluateJavaScript(_ script: String) {
        if let webView = bridge?.webView {
            webView.evaluateJavaScript(script) { _, error in
                if let error = error {
                    NSLog("Error executing JavaScript: \(error)")
                }
            }
        }
    }
}
