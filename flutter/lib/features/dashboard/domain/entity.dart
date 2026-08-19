/// Dashboard domain entity representing the active rider dashboard state.
class DashboardEntity {
  final String riderName;
  final String vehicleModel;
  final String vehicleNumber;
  final int batteryLevel;
  final double todayDistance;
  final double todayEarnings;
  final List<double> weeklyEarnings;
  final int earningStreak;
  final int planDaysRemaining;
  final bool isOverdue;

  const DashboardEntity({
    this.riderName = '',
    this.vehicleModel = '',
    this.vehicleNumber = '',
    this.batteryLevel = 0,
    this.todayDistance = 0,
    this.todayEarnings = 0,
    this.weeklyEarnings = const [],
    this.earningStreak = 0,
    this.planDaysRemaining = 0,
    this.isOverdue = false,
  });
}
