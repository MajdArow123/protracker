using ProTracker.Models;

namespace ProTracker.Dtos;

public class TrainingSessionDto
{
    public int Id { get; set; }
    public int PlayerId { get; set; }
    public int TeamId { get; set; }
    public DateTime Date { get; set; }
    public int DurationMinutes { get; set; }
    public string? Notes { get; set; }
    public AttendanceStatus AttendanceStatus { get; set; }
}

public class CreateTrainingSessionDto
{
    public int PlayerId { get; set; }
    public int TeamId { get; set; }
    public DateTime Date { get; set; }
    public int DurationMinutes { get; set; }
    public string? Notes { get; set; }
    public AttendanceStatus AttendanceStatus { get; set; }
}
