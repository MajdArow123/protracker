using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using ProTracker.Data;
using ProTracker.Dtos;
using ProTracker.Models;
using ProTracker.Services;
using ProTracker.Validation;

namespace ProTracker.Tests;

// Phase 6 — lineup workflow: named lineups, optimistic versioning, draft/publish
// lock, tactical presets, and the lightweight change audit.

public class LineupWorkflowValidatorTests
{
    private static SaveLineupDto Valid() => new()
    {
        Formation = "4-3-3",
        Slots = new List<LineupSlotDto> { new() { SlotKey = "GK", PlayerId = 1 } },
    };

    [Fact]
    public void Named_team_lineup_passes_but_named_match_lineup_fails()
    {
        var dto = Valid();
        dto.Name = "First Team";
        Assert.True(new SaveLineupDtoValidator().Validate(dto).IsValid);

        dto.MatchResultId = 5;
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void Name_longer_than_60_fails()
    {
        var dto = Valid();
        dto.Name = new string('n', 61);
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    [Fact]
    public void BaseVersion_zero_fails_and_positive_passes()
    {
        var dto = Valid();
        dto.BaseVersion = 0;
        Assert.False(new SaveLineupDtoValidator().Validate(dto).IsValid);
        dto.BaseVersion = 1;
        Assert.True(new SaveLineupDtoValidator().Validate(dto).IsValid);
    }

    private static SaveTacticalPresetDto ValidPreset() => new()
    {
        SportId = 1,
        Name = "High Press",
        Formation = "4-3-3",
        Roles = new Dictionary<string, string> { ["GK"] = "sweeperKeeper" },
        Labels = new List<string> { "highPress" },
    };

    [Fact]
    public void Valid_preset_passes()
    {
        Assert.True(new SaveTacticalPresetDtoValidator().Validate(ValidPreset()).IsValid);
    }

    [Fact]
    public void Preset_shape_rules_fail_bad_payloads()
    {
        var v = new SaveTacticalPresetDtoValidator();

        var noName = ValidPreset();
        noName.Name = " ";
        Assert.False(v.Validate(noName).IsValid);

        var noSport = ValidPreset();
        noSport.SportId = 0;
        Assert.False(v.Validate(noSport).IsValid);

        var tooManyRoles = ValidPreset();
        tooManyRoles.Roles = Enumerable.Range(1, 12).ToDictionary(i => $"S{i}", _ => "role");
        Assert.False(v.Validate(tooManyRoles).IsValid);

        var longSlotKey = ValidPreset();
        longSlotKey.Roles = new Dictionary<string, string> { [new string('k', 17)] = "role" };
        Assert.False(v.Validate(longSlotKey).IsValid);

        var commaLabel = ValidPreset();
        commaLabel.Labels = new List<string> { "high,press" };
        Assert.False(v.Validate(commaLabel).IsValid);
    }
}

// Pure summarizer — every audit line comes from a real diff, never "updated".
public class LineupDiffSummarizerTests
{
    private static LineupSnapshot Snap(
        string formation = "4-3-3",
        Dictionary<string, int>? slots = null,
        int? captain = null,
        int? vice = null,
        string signature = "sig")
        => new(formation, slots ?? new Dictionary<string, int> { ["GK"] = 1, ["A1"] = 2 }, captain, vice, signature);

    private static readonly Dictionary<int, string> Names = new()
    {
        [1] = "Liam Carter", [2] = "Noah Bennett", [3] = "Lucas Ward",
        [4] = "Jack Turner", [5] = "Leo Moore", [6] = "Ben Hall",
    };

    [Fact]
    public void Created_summary_states_formation_and_player_count()
    {
        Assert.Equal("Created — 4-3-3, 2 players", LineupDiffSummarizer.SummarizeCreated(Snap()));
    }

    [Fact]
    public void No_material_change_returns_empty()
    {
        Assert.Equal("", LineupDiffSummarizer.SummarizeSave(Snap(), Snap(), Names));
    }

    [Fact]
    public void Formation_change_is_reported()
    {
        var summary = LineupDiffSummarizer.SummarizeSave(Snap(), Snap(formation: "4-4-2"), Names);
        Assert.Equal("Formation 4-3-3 → 4-4-2", summary);
    }

    [Fact]
    public void Players_in_and_out_are_named()
    {
        var after = Snap(slots: new Dictionary<string, int> { ["GK"] = 1, ["A1"] = 3 });
        var summary = LineupDiffSummarizer.SummarizeSave(Snap(), after, Names);
        Assert.Equal("In: Lucas Ward · Out: Noah Bennett", summary);
    }

    [Fact]
    public void Long_name_lists_are_capped_with_a_count()
    {
        var before = Snap(slots: new Dictionary<string, int> { ["GK"] = 1 });
        var after = Snap(slots: new Dictionary<string, int>
        {
            ["GK"] = 1, ["D1"] = 2, ["D2"] = 3, ["M1"] = 4, ["M2"] = 5, ["A1"] = 6,
        });
        var summary = LineupDiffSummarizer.SummarizeSave(before, after, Names);
        Assert.Contains("+2 more", summary);
        Assert.DoesNotContain("Leo Moore", summary); // 4th name is folded into the count
    }

    [Fact]
    public void Same_players_in_new_slots_report_repositioned_count()
    {
        var after = Snap(slots: new Dictionary<string, int> { ["GK"] = 2, ["A1"] = 1 });
        Assert.Equal("2 repositioned", LineupDiffSummarizer.SummarizeSave(Snap(), after, Names));
    }

    [Fact]
    public void Captaincy_changes_are_reported_set_and_removed()
    {
        Assert.Equal("Captain: Liam Carter",
            LineupDiffSummarizer.SummarizeSave(Snap(), Snap(captain: 1), Names));
        Assert.Equal("Captain removed",
            LineupDiffSummarizer.SummarizeSave(Snap(captain: 1), Snap(), Names));
        Assert.Equal("Vice-captain: Noah Bennett",
            LineupDiffSummarizer.SummarizeSave(Snap(), Snap(vice: 2), Names));
    }

    [Fact]
    public void Tactical_detail_changes_are_reported_without_faking_specifics()
    {
        var summary = LineupDiffSummarizer.SummarizeSave(Snap(), Snap(signature: "sig2"), Names);
        Assert.Equal("Tactical details updated", summary);
    }

    [Fact]
    public void Unknown_player_ids_fall_back_honestly()
    {
        var after = Snap(slots: new Dictionary<string, int> { ["GK"] = 1, ["A1"] = 99 });
        var summary = LineupDiffSummarizer.SummarizeSave(Snap(), after, Names);
        Assert.Contains("Player 99", summary);
    }

    [Fact]
    public void Signature_builder_is_order_insensitive_and_null_tolerant()
    {
        var a = LineupDiffSummarizer.BuildTacticalSignature("notes", new[] { "b", "a" },
            new[] { new KeyValuePair<string, string?>("GK", "sweeper"), new KeyValuePair<string, string?>("A1", null) },
            new[] { new KeyValuePair<string, int>("penalties", 3) });
        var b = LineupDiffSummarizer.BuildTacticalSignature("notes", new[] { "a", "b" },
            new[] { new KeyValuePair<string, string?>("A1", null), new KeyValuePair<string, string?>("GK", "sweeper") },
            new[] { new KeyValuePair<string, int>("penalties", 3) });
        Assert.Equal(a, b);
        Assert.NotEqual(a, LineupDiffSummarizer.BuildTacticalSignature(null, null, null, null));
    }
}

public class LineupVersioningTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public LineupVersioningTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string LineupUrl => $"/api/teams/{TestAuth.SoccerTeamId}/lineup";

    private static SaveLineupDto Xi(string formation = "4-3-3", int? baseVersion = null) => new()
    {
        Formation = formation,
        BaseVersion = baseVersion,
        Slots = new List<LineupSlotDto>
        {
            new() { SlotKey = "GK", PlayerId = TestAuth.LiamCarterPlayerId },
            new() { SlotKey = "A1", PlayerId = TestAuth.LucasWardPlayerId },
        },
    };

    [Fact]
    public async Task Stale_or_missing_base_version_conflicts_and_never_clobbers()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // Create: BaseVersion not required, version starts at 1.
        var created = (await (await coach.PutAsJsonAsync(LineupUrl, Xi())).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal(1, created.Version);
        Assert.Equal("Draft", created.Status);

        // Missing BaseVersion on an existing row → 409 (strict, no legacy clobber path).
        Assert.Equal(HttpStatusCode.Conflict,
            (await coach.PutAsJsonAsync(LineupUrl, Xi("4-4-2"))).StatusCode);

        // Stale BaseVersion → 409, and the stored lineup is untouched.
        Assert.Equal(HttpStatusCode.Conflict,
            (await coach.PutAsJsonAsync(LineupUrl, Xi("4-4-2", baseVersion: 999))).StatusCode);
        var after = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!;
        Assert.Equal("4-3-3", after.Formation);
        Assert.Equal(1, after.Version);

        // Matching BaseVersion → saved, version bumps.
        var resaved = (await (await coach.PutAsJsonAsync(LineupUrl, Xi("4-4-2", baseVersion: 1))).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal(2, resaved.Version);

        await coach.DeleteAsync(LineupUrl);
    }

    [Fact]
    public async Task Base_version_against_a_missing_row_conflicts_instead_of_recreating()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // No lineup exists for this key. A BaseVersion claims "I'm updating an
        // existing row" — the row being gone (deleted elsewhere) is a conflict,
        // never a silent re-create.
        Assert.Equal(HttpStatusCode.Conflict,
            (await coach.PutAsJsonAsync(LineupUrl, Xi("4-3-3", baseVersion: 1))).StatusCode);
        Assert.Null((await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data);

        // Without a BaseVersion the same payload is an honest create.
        var created = (await (await coach.PutAsJsonAsync(LineupUrl, Xi())).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal(1, created.Version);
        await coach.DeleteAsync(LineupUrl);
    }

    [Fact]
    public async Task Audit_records_real_diffs_and_skips_no_change_saves()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        // A uniquely named lineup keys this test's audit trail — the class
        // fixture shares one DB, so "Default XI" entries from other tests exist.
        const string probeName = "Audit Probe";
        var url = $"{LineupUrl}?name=Audit%20Probe";
        var namedXi = Xi();
        namedXi.Name = probeName;
        var created = (await (await coach.PutAsJsonAsync(LineupUrl, namedXi)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;

        // A real change: Lucas out, Noah in.
        var change = Xi("4-3-3", baseVersion: created.Version);
        change.Name = probeName;
        change.Slots[1] = new LineupSlotDto { SlotKey = "A1", PlayerId = TestAuth.NoahBennettPlayerId };
        var changed = (await (await coach.PutAsJsonAsync(LineupUrl, change)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;

        // An identical re-save: version bumps (a save is a save) but no audit noise.
        var same = Xi("4-3-3", baseVersion: changed.Version);
        same.Name = probeName;
        same.Slots[1] = new LineupSlotDto { SlotKey = "A1", PlayerId = TestAuth.NoahBennettPlayerId };
        (await coach.PutAsJsonAsync(LineupUrl, same)).EnsureSuccessStatusCode();

        var audit = (await coach.GetFromJsonAsync<TestApiResponse<PagedResult<LineupAuditEntryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup-audit"))!.Data!;

        var entries = audit.Items.Where(a => a.KeyLabel == probeName).ToList();
        Assert.Equal(2, entries.Count); // created + the real change; the no-op save wrote nothing
        Assert.Equal("saved", entries[0].Action);
        Assert.Contains("In: Noah Bennett", entries[0].Summary);
        Assert.Contains("Out: Lucas Ward", entries[0].Summary);
        Assert.Equal("created", entries[1].Action);
        Assert.StartsWith("Created — 4-3-3", entries[1].Summary);
        Assert.All(entries, e => Assert.False(string.IsNullOrWhiteSpace(e.ChangedByName)));

        // Delete writes its own entry and the history survives the lineup.
        await coach.DeleteAsync(url);
        var afterDelete = (await coach.GetFromJsonAsync<TestApiResponse<PagedResult<LineupAuditEntryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup-audit"))!.Data!;
        var deleteEntry = afterDelete.Items.First(a => a.KeyLabel == probeName);
        Assert.Equal("deleted", deleteEntry.Action);
        Assert.Null(deleteEntry.LineupId); // SetNull semantics — history outlives the row
        Assert.Equal(3, afterDelete.Items.Count(a => a.KeyLabel == probeName));
    }
}

public class LineupPublishTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public LineupPublishTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string LineupUrl => $"/api/teams/{TestAuth.SoccerTeamId}/lineup";

    private static SaveLineupDto Xi(int? baseVersion = null) => new()
    {
        Formation = "4-3-3",
        BaseVersion = baseVersion,
        Slots = new List<LineupSlotDto> { new() { SlotKey = "GK", PlayerId = TestAuth.LiamCarterPlayerId } },
    };

    [Fact]
    public async Task Publish_locks_the_lineup_until_an_explicit_unpublish()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var created = (await (await coach.PutAsJsonAsync(LineupUrl, Xi())).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;

        // Head coach publishes (implicit CanPublishLineup via All()).
        var published = (await (await coach.PostAsync($"/api/lineups/{created.Id}/publish", null)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal("Published", published.Status);
        Assert.NotNull(published.PublishedAt);
        Assert.Equal(created.Version + 1, published.Version);

        // Publishing twice is a validation error, not a silent no-op.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await coach.PostAsync($"/api/lineups/{created.Id}/publish", null)).StatusCode);

        // Published = locked: save and delete both 409, even with the right version.
        Assert.Equal(HttpStatusCode.Conflict,
            (await coach.PutAsJsonAsync(LineupUrl, Xi(baseVersion: published.Version))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await coach.DeleteAsync(LineupUrl)).StatusCode);

        // Unpublish reopens editing; version keeps moving forward.
        var unpublished = (await (await coach.PostAsync($"/api/lineups/{created.Id}/unpublish", null)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal("Draft", unpublished.Status);
        Assert.Null(unpublished.PublishedAt);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await coach.PostAsync($"/api/lineups/{created.Id}/unpublish", null)).StatusCode);
        (await coach.PutAsJsonAsync(LineupUrl, Xi(baseVersion: unpublished.Version))).EnsureSuccessStatusCode();

        // The audit carries both workflow actions.
        var audit = (await coach.GetFromJsonAsync<TestApiResponse<PagedResult<LineupAuditEntryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup-audit?lineupId={created.Id}"))!.Data!;
        Assert.Contains(audit.Items, a => a.Action == "published");
        Assert.Contains(audit.Items, a => a.Action == "unpublished");

        await coach.DeleteAsync(LineupUrl);
    }

    [Fact]
    public async Task Publish_denied_for_other_coach_and_athlete_and_missing_lineup()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var created = (await (await coach.PutAsJsonAsync(LineupUrl, Xi())).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;

        var otherCoach = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await otherCoach.PostAsync($"/api/lineups/{created.Id}/publish", null)).StatusCode);

        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await athlete.PostAsync($"/api/lineups/{created.Id}/publish", null)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound,
            (await coach.PostAsync("/api/lineups/999999/publish", null)).StatusCode);

        await coach.DeleteAsync(LineupUrl);
    }
}

public class NamedLineupTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public NamedLineupTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string LineupUrl => $"/api/teams/{TestAuth.SoccerTeamId}/lineup";

    private static SaveLineupDto Xi(string? name, string formation = "4-3-3", int? baseVersion = null) => new()
    {
        Name = name,
        Formation = formation,
        BaseVersion = baseVersion,
        Slots = new List<LineupSlotDto> { new() { SlotKey = "GK", PlayerId = TestAuth.LiamCarterPlayerId } },
    };

    [Fact]
    public async Task Named_lineups_coexist_with_default_and_key_case_insensitively()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        (await coach.PutAsJsonAsync(LineupUrl, Xi(null))).EnsureSuccessStatusCode();
        var firstTeam = (await (await coach.PutAsJsonAsync(LineupUrl, Xi("First Team", "4-4-2"))).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        (await coach.PutAsJsonAsync(LineupUrl, Xi("Rotation", "3-5-2"))).EnsureSuccessStatusCode();

        // Three distinct keys, three rows.
        var list = (await coach.GetFromJsonAsync<TestApiResponse<List<LineupSummaryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineups"))!.Data!;
        Assert.Equal(3, list.Count);
        Assert.Null(list[0].Name);                 // default XI first
        Assert.Equal("First Team", list[1].Name);  // then named, A→Z
        Assert.Equal("Rotation", list[2].Name);

        // Case-insensitive key: read and re-save under different casing hit the same row.
        var got = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"{LineupUrl}?name=first%20team"))!.Data!;
        Assert.Equal(firstTeam.Id, got.Id);
        var resaved = (await (await coach.PutAsJsonAsync(
                LineupUrl, Xi("FIRST TEAM", "4-2-3-1", baseVersion: firstTeam.Version))).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal(firstTeam.Id, resaved.Id);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Assert.Equal(3, await db.Lineups.CountAsync(l => l.TeamId == TestAuth.SoccerTeamId));
        }

        // The default XI never absorbed the named saves.
        var stillDefault = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!;
        Assert.Equal("4-3-3", stillDefault.Formation);

        await coach.DeleteAsync($"{LineupUrl}?name=First%20Team");
        await coach.DeleteAsync($"{LineupUrl}?name=Rotation");
        await coach.DeleteAsync(LineupUrl);
        var emptied = (await coach.GetFromJsonAsync<TestApiResponse<List<LineupSummaryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineups"))!.Data!;
        Assert.Empty(emptied);
    }

    [Fact]
    public async Task Named_lineups_are_capped_per_team()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        for (var i = 1; i <= 10; i++)
            (await coach.PutAsJsonAsync(LineupUrl, Xi($"Preset {i}"))).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.BadRequest,
            (await coach.PutAsJsonAsync(LineupUrl, Xi("One Too Many"))).StatusCode);
        // Updating an existing named lineup is still allowed at the cap.
        var first = (await coach.GetFromJsonAsync<TestApiResponse<LineupDto>>(
            $"{LineupUrl}?name=Preset%201"))!.Data!;
        (await coach.PutAsJsonAsync(LineupUrl, Xi("Preset 1", "4-4-2", baseVersion: first.Version)))
            .EnsureSuccessStatusCode();

        for (var i = 1; i <= 10; i++)
            await coach.DeleteAsync($"{LineupUrl}?name=Preset%20{i}");
    }
}

// The server-side authz matrix: publish is gated tighter than edit, and the UI
// permission (CanPublishLineup) is a real stored permission on TeamCoachRole.
public class LineupAuthzMatrixTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public LineupAuthzMatrixTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static string LineupUrl => $"/api/teams/{TestAuth.SoccerTeamId}/lineup";

    private static SaveLineupDto Xi(int? baseVersion = null) => new()
    {
        Formation = "4-3-3",
        BaseVersion = baseVersion,
        Slots = new List<LineupSlotDto> { new() { SlotKey = "GK", PlayerId = TestAuth.LiamCarterPlayerId } },
    };

    private async Task<(HttpClient Client, int RoleId)> CreateAssistantAsync(
        HttpClient headCoach, string email, CoachPermissionsDto permissions)
    {
        var invite = await headCoach.PostAsJsonAsync($"/api/teams/{TestAuth.SoccerTeamId}/invite-coach",
            new InviteCoachDto { Email = email, Permissions = permissions });
        invite.EnsureSuccessStatusCode();
        var inviteUrl = (await invite.Content.ReadFromJsonAsync<TestApiResponse<InviteCoachResultDto>>())!.Data!.InviteUrl;
        var token = inviteUrl[(inviteUrl.LastIndexOf('/') + 1)..];

        var accept = await _factory.CreateClient().PostAsJsonAsync("/api/assistant-invites/accept",
            new AcceptCoachInviteDto { Token = token, Password = TestAuth.SeedPassword, FullName = "Matrix Assistant" });
        accept.EnsureSuccessStatusCode();

        var client = await TestAuth.LoginAsync(_factory, email, TestAuth.SeedPassword);

        // Probe DTO: the server serializes enums as names, which the plain test
        // deserializer can't map back into CoachRoleType — read only what we need.
        var coaches = (await headCoach.GetFromJsonAsync<TestApiResponse<List<CoachProbeDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/coaches"))!.Data!;
        var roleId = coaches.Single(c => c.Email == email).Id!.Value;
        return (client, roleId);
    }

    private class CoachProbeDto
    {
        public int? Id { get; set; }
        public string? Email { get; set; }
    }

    [Fact]
    public async Task Assistant_edit_and_publish_split_follows_stored_permissions()
    {
        var headCoach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var (assistant, roleId) = await CreateAssistantAsync(headCoach, "matrix.assistant@protracker.test",
            new CoachPermissionsDto
            {
                CanAssessPlayers = true, CanAssignTasks = true,
                CanManagePlayers = true, CanManageTeam = true,
                CanPublishLineup = false,
            });

        // CanManageTeam → the assistant can read, save and reset drafts…
        var created = (await (await assistant.PutAsJsonAsync(LineupUrl, Xi())).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal("Draft", created.Status);
        Assert.NotNull((await assistant.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data);

        // …but NOT publish (403), and the permission DTO says so.
        Assert.Equal(HttpStatusCode.Forbidden,
            (await assistant.PostAsync($"/api/lineups/{created.Id}/publish", null)).StatusCode);
        var perms = (await assistant.GetFromJsonAsync<TestApiResponse<CoachPermissionsDto>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/my-coach-permissions"))!.Data!;
        Assert.True(perms.CanManageTeam);
        Assert.False(perms.CanPublishLineup);

        // The head coach grants CanPublishLineup → publish unlocks live.
        var updated = new CoachPermissionsDto
        {
            CanAssessPlayers = true, CanAssignTasks = true,
            CanManagePlayers = true, CanManageTeam = true, CanPublishLineup = true,
        };
        (await headCoach.PutAsJsonAsync($"/api/team-coaches/{roleId}/permissions", updated))
            .EnsureSuccessStatusCode();
        var published = (await (await assistant.PostAsync($"/api/lineups/{created.Id}/publish", null)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal("Published", published.Status);

        // Cleanup: unpublish, delete, remove the assistant.
        (await assistant.PostAsync($"/api/lineups/{created.Id}/unpublish", null)).EnsureSuccessStatusCode();
        (await headCoach.DeleteAsync(LineupUrl)).EnsureSuccessStatusCode();
        (await headCoach.DeleteAsync($"/api/team-coaches/{roleId}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Analyst_without_manage_or_publish_can_read_but_never_write()
    {
        var headCoach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        (await headCoach.PutAsJsonAsync(LineupUrl, Xi())).EnsureSuccessStatusCode();
        var lineupId = (await headCoach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data!.Id;

        var (analyst, roleId) = await CreateAssistantAsync(headCoach, "matrix.analyst@protracker.test",
            new CoachPermissionsDto { CanAssessPlayers = true }); // no manage, no publish

        // Team access → reads work (lineup, list, audit).
        Assert.NotNull((await analyst.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data);
        Assert.NotNull((await analyst.GetFromJsonAsync<TestApiResponse<List<LineupSummaryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineups"))!.Data);
        Assert.NotNull((await analyst.GetFromJsonAsync<TestApiResponse<PagedResult<LineupAuditEntryDto>>>(
            $"/api/teams/{TestAuth.SoccerTeamId}/lineup-audit"))!.Data);

        // Every write path is denied.
        Assert.Equal(HttpStatusCode.Forbidden, (await analyst.PutAsJsonAsync(LineupUrl, Xi(2))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await analyst.DeleteAsync(LineupUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await analyst.PostAsync($"/api/lineups/{lineupId}/publish", null)).StatusCode);

        (await headCoach.DeleteAsync(LineupUrl)).EnsureSuccessStatusCode();
        (await headCoach.DeleteAsync($"/api/team-coaches/{roleId}")).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Admin_bypasses_team_permission_checks_on_every_write()
    {
        const string adminEmail = "matrix.admin@protracker.test";
        using (var scope = _factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            if (await users.FindByEmailAsync(adminEmail) == null)
            {
                var user = new ApplicationUser { UserName = adminEmail, Email = adminEmail, DisplayName = "Matrix Admin" };
                Assert.True((await users.CreateAsync(user, TestAuth.SeedPassword)).Succeeded);
                Assert.True((await users.AddToRoleAsync(user, "Admin")).Succeeded);
            }
        }

        var headCoach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);
        var created = (await (await headCoach.PutAsJsonAsync(LineupUrl, Xi())).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;

        // The admin is not a coach on any team, yet every gated write passes.
        var admin = await TestAuth.LoginAsync(_factory, adminEmail, TestAuth.SeedPassword);
        var published = (await (await admin.PostAsync($"/api/lineups/{created.Id}/publish", null)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal("Published", published.Status);
        var unpublished = (await (await admin.PostAsync($"/api/lineups/{created.Id}/unpublish", null)).Content
            .ReadFromJsonAsync<TestApiResponse<LineupDto>>())!.Data!;
        Assert.Equal("Draft", unpublished.Status);
        (await admin.PutAsJsonAsync(LineupUrl, Xi(baseVersion: unpublished.Version))).EnsureSuccessStatusCode();
        (await admin.DeleteAsync(LineupUrl)).EnsureSuccessStatusCode();
        Assert.Null((await headCoach.GetFromJsonAsync<TestApiResponse<LineupDto>>(LineupUrl))!.Data);
    }
}

public class TacticalPresetEndpointTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;

    public TacticalPresetEndpointTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private static SaveTacticalPresetDto Preset(string name = "High Press", int sportId = 1) => new()
    {
        SportId = sportId,
        Name = name,
        Formation = "4-3-3",
        Roles = new Dictionary<string, string> { ["GK"] = "sweeperKeeper", ["A1"] = "falseNine" },
        Labels = new List<string> { "highPress", "counter" },
    };

    [Fact]
    public async Task Preset_crud_round_trip_is_owner_scoped()
    {
        var coach = await TestAuth.LoginAsync(_factory, TestAuth.SoccerCoachEmail, TestAuth.SeedPassword);

        var created = (await (await coach.PostAsJsonAsync("/api/tactical-presets", Preset())).Content
            .ReadFromJsonAsync<TestApiResponse<TacticalPresetDto>>())!.Data!;
        Assert.Equal("High Press", created.Name);
        Assert.Equal("sweeperKeeper", created.Roles["GK"]);
        Assert.Equal(new[] { "highPress", "counter" }, created.Labels);

        // Duplicate name for the same sport (case-insensitive) is rejected.
        Assert.Equal(HttpStatusCode.BadRequest,
            (await coach.PostAsJsonAsync("/api/tactical-presets", Preset("HIGH PRESS"))).StatusCode);

        // Sport filter works; a different sport returns nothing.
        var mine = (await coach.GetFromJsonAsync<TestApiResponse<List<TacticalPresetDto>>>(
            "/api/tactical-presets?sport=1"))!.Data!;
        Assert.Single(mine);
        Assert.Empty((await coach.GetFromJsonAsync<TestApiResponse<List<TacticalPresetDto>>>(
            "/api/tactical-presets?sport=2"))!.Data!);

        // Update: rename + new roles; changing the sport is rejected.
        var update = Preset("Mid Block");
        update.Roles = new Dictionary<string, string> { ["D1"] = "ballPlaying" };
        var updated = (await (await coach.PutAsJsonAsync($"/api/tactical-presets/{created.Id}", update)).Content
            .ReadFromJsonAsync<TestApiResponse<TacticalPresetDto>>())!.Data!;
        Assert.Equal("Mid Block", updated.Name);
        Assert.Equal("ballPlaying", updated.Roles["D1"]);
        var crossSport = Preset("Mid Block", sportId: 2);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await coach.PutAsJsonAsync($"/api/tactical-presets/{created.Id}", crossSport)).StatusCode);

        // Another coach can't see, edit, or delete it.
        var otherCoach = await TestAuth.LoginAsync(_factory, TestAuth.BasketballCoachEmail, TestAuth.SeedPassword);
        Assert.Empty((await otherCoach.GetFromJsonAsync<TestApiResponse<List<TacticalPresetDto>>>(
            "/api/tactical-presets?sport=1"))!.Data!);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await otherCoach.PutAsJsonAsync($"/api/tactical-presets/{created.Id}", update)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await otherCoach.DeleteAsync($"/api/tactical-presets/{created.Id}")).StatusCode);

        // Athletes have no preset surface at all (role gate).
        var athlete = await TestAuth.LoginAsync(_factory, TestAuth.LucasWardAthleteEmail, TestAuth.SeedPassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await athlete.GetAsync("/api/tactical-presets")).StatusCode);

        (await coach.DeleteAsync($"/api/tactical-presets/{created.Id}")).EnsureSuccessStatusCode();
        Assert.Empty((await coach.GetFromJsonAsync<TestApiResponse<List<TacticalPresetDto>>>(
            "/api/tactical-presets"))!.Data!);
    }
}

// The AddLineupWorkflow migration must apply AND roll back cleanly on the
// SQLite test provider too (prod runs Npgsql; both paths stay pinned here) —
// including the hand-edited Version=1 backfill for pre-existing lineup rows.
public class LineupWorkflowMigrationTests : IClassFixture<ProTrackerWebApplicationFactory>
{
    private readonly ProTrackerWebApplicationFactory _factory;
    private const string PreviousMigration = "20260717174750_AddTacticalLayer";

    public LineupWorkflowMigrationTests(ProTrackerWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AddLineupWorkflow_rolls_back_and_reapplies_on_sqlite()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var migrator = db.GetService<IMigrator>();

        Assert.True(await TableExistsAsync(db, "TacticalPresets"));
        Assert.True(await TableExistsAsync(db, "LineupChangeAudits"));
        foreach (var column in new[] { "Name", "Status", "Version", "PublishedAt" })
            Assert.True(await ColumnExistsAsync(db, "Lineups", column));

        await migrator.MigrateAsync(PreviousMigration);
        Assert.False(await TableExistsAsync(db, "TacticalPresets"));
        Assert.False(await TableExistsAsync(db, "LineupChangeAudits"));
        foreach (var column in new[] { "Name", "Status", "Version", "PublishedAt" })
            Assert.False(await ColumnExistsAsync(db, "Lineups", column));

        // A lineup row saved before the migration must come back as Version 1
        // (the hand-edited default), not 0 — 0 would be unsaveable under the
        // BaseVersion > 0 contract.
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO Lineups (TeamId, Formation, UpdatedAt) VALUES (1, '4-3-3', '2026-01-01 00:00:00')");

        await migrator.MigrateAsync();
        Assert.True(await TableExistsAsync(db, "TacticalPresets"));
        Assert.True(await TableExistsAsync(db, "LineupChangeAudits"));
        var version = await ScalarAsync(db, "SELECT Version FROM Lineups WHERE Formation = '4-3-3' LIMIT 1");
        Assert.Equal(1L, version);
        var status = await ScalarAsync(db, "SELECT Status FROM Lineups WHERE Formation = '4-3-3' LIMIT 1");
        Assert.Equal(0L, status); // Draft

        await db.Database.ExecuteSqlRawAsync("DELETE FROM Lineups WHERE Formation = '4-3-3'");
    }

    private static async Task<bool> TableExistsAsync(ApplicationDbContext db, string table)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='{table}'");
        return Convert.ToInt64(result) > 0;
    }

    private static async Task<bool> ColumnExistsAsync(ApplicationDbContext db, string table, string column)
    {
        var result = await ScalarAsync(db,
            $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name='{column}'");
        return Convert.ToInt64(result) > 0;
    }

    private static async Task<object?> ScalarAsync(ApplicationDbContext db, string sql)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        return await cmd.ExecuteScalarAsync();
    }
}
