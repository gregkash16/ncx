import UIKit
import Capacitor
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    var window: UIWindow?
    var appleAuthController: ASAuthorizationController?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name.init("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }

    // MARK: - Sign in with Apple

    /// Called from JavaScript when user taps "Sign in with Apple" button
    func initiateAppleSignIn() {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        self.appleAuthController = controller
        controller.performRequests()
    }

    // MARK: - ASAuthorizationControllerDelegate

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            return
        }

        // Extract user information
        let fullName = appleIDCredential.fullName
        let email = appleIDCredential.email ?? "unknown@apple.com"

        // Build name string
        var nameComponents: [String] = []
        if let givenName = fullName?.givenName {
            nameComponents.append(givenName)
        }
        if let familyName = fullName?.familyName {
            nameComponents.append(familyName)
        }

        let name = nameComponents.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        let finalName = !name.isEmpty ? name : "Apple User"

        // Send to web view
        sendAppleSignInToWebView(name: finalName, email: email)
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        print("Sign in with Apple error: \(error.localizedDescription)")
        // Notify web view of error
        notifyWebViewOfAppleSignInError(error.localizedDescription)
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return self.window ?? ASPresentationAnchor()
    }

    // MARK: - Web View Communication

    private func sendAppleSignInToWebView(name: String, email: String) {
        DispatchQueue.main.async {
            let jsonString = """
            {"name": "\(name.replacingOccurrences(of: "\"", with: "\\\""))", "email": "\(email.replacingOccurrences(of: "\"", with: "\\\""))"}
            """

            let script = "window.signInWithAppleComplete && window.signInWithAppleComplete(\(jsonString))"

            if let webView = self.window?.rootViewController?.view as? UIView {
                // For WKWebView
                if let wkWebView = webView as? UIView {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        // Try to find the WKWebView
                        self.executeJavaScriptInWebView(script)
                    }
                }
            }
        }
    }

    private func notifyWebViewOfAppleSignInError(_ errorMessage: String) {
        DispatchQueue.main.async {
            let escapedError = errorMessage.replacingOccurrences(of: "\"", with: "\\\"")
            let script = "window.signInWithAppleError && window.signInWithAppleError('\(escapedError)')"
            self.executeJavaScriptInWebView(script)
        }
    }

    private func executeJavaScriptInWebView(_ script: String) {
        // This will be called from Capacitor's bridge
        NotificationCenter.default.post(
            name: NSNotification.Name("executeAppleSignInScript"),
            object: script
        )
    }

}
