import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_theme.dart';
import '../core/network/api_client.dart';
import '../core/network/generated/api_client.dart';
import '../features/auth/data/repository_impl.dart';
import '../features/auth/domain/repository.dart';
import '../features/auth/presentation/controllers/auth_controller.dart';
import 'router.dart';

/// Voltium Rider Application
///
/// Feature-first architecture entry point. Bootstraps core services
/// (theme, network client, storage) and uses [AppRouter] for
/// auth-aware screen navigation.
class VoltiumApp extends StatefulWidget {
  const VoltiumApp({super.key});

  @override
  State<VoltiumApp> createState() => _VoltiumAppState();
}

class _VoltiumAppState extends State<VoltiumApp> {
  late final ApiClient _apiClient;
  late final VoltiumApiClient _voltiumApiClient;
  late final AuthRepository _authRepository;

  @override
  void initState() {
    super.initState();
    _apiClient = ApiClient();
    _voltiumApiClient = VoltiumApiClient(_apiClient);
    _authRepository = AuthRepositoryImpl(_apiClient, _voltiumApiClient);

    // Initiate session check after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthController>().checkSession();
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        // Core services
        Provider<ApiClient>.value(value: _apiClient),
        Provider<VoltiumApiClient>.value(value: _voltiumApiClient),
        Provider<AuthRepository>.value(value: _authRepository),

        // Feature controllers
        ChangeNotifierProvider(
          create: (_) => AuthController(
            repository: _authRepository,
          ),
        ),
      ],
      child: MaterialApp(
        title: 'Voltium',
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.light,
        debugShowCheckedModeBanner: false,
        home: const AppRouter(),
      ),
    );
  }
}
