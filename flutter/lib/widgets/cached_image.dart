import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/network/api_client.dart';
import '../theme/app_theme.dart';

class CachedImage extends StatelessWidget {
  final String? imageUrl;
  final double? width;
  final double? height;
  final double borderRadius;
  final BoxFit fit;
  final Widget? placeholder;
  final Widget? errorWidget;

  const CachedImage({
    super.key,
    this.imageUrl,
    this.width,
    this.height,
    this.borderRadius = 0,
    this.fit = BoxFit.cover,
    this.placeholder,
    this.errorWidget,
  });

  static String? resolveUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.isEmpty) return null;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    final baseUrl = ApiClient().baseUrl;
    final clean = rawUrl.replaceFirst(RegExp(r'^/+'), '');
    if (clean.startsWith('api/files/')) {
      return '$baseUrl/$clean';
    }
    return '$baseUrl/api/files/$clean';
  }

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = resolveUrl(imageUrl);
    if (resolvedUrl == null || resolvedUrl.isEmpty) {
      return _buildPlaceholder(context);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: CachedNetworkImage(
        imageUrl: resolvedUrl,
        width: width,
        height: height,
        fit: fit,
        memCacheWidth: 500,
        placeholder: (context, url) =>
            placeholder ?? _buildPlaceholder(context),
        errorWidget: (context, url, error) =>
            errorWidget ?? _buildError(context),
      ),
    );
  }

  Widget _buildPlaceholder(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: width,
      height: height,
      color: colors.outlineVariant,
      child: const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }

  Widget _buildError(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: width,
      height: height,
      color: colors.outlineVariant,
      child: const Icon(Icons.image_not_supported,
          color: AppColors.onSurfaceVariant),
    );
  }
}

class AvatarImage extends StatelessWidget {
  final String? imageUrl;
  final double size;
  final VoidCallback? onTap;

  const AvatarImage({
    super.key,
    this.imageUrl,
    this.size = 48,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: CachedImage(
        imageUrl: imageUrl,
        width: size,
        height: size,
        borderRadius: size / 2,
        fit: BoxFit.cover,
        placeholder: CircleAvatar(
          radius: size / 2,
          backgroundColor: colors.outlineVariant,
        ),
        errorWidget: CircleAvatar(
          radius: size / 2,
          backgroundColor: colors.divider,
          child: Icon(Icons.person, size: size * 0.5),
        ),
      ),
    );
  }
}
