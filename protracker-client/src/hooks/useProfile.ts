import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi, type ProfileUpdatePayload } from '../api/profileApi';
import { useAuth } from '../context/useAuth';

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.get,
    enabled: !!user,
    staleTime: 60_000,
  });
}

function useInvalidateProfile() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['profile'] });
    // Athlete profile edits touch the Player record too.
    qc.invalidateQueries({ queryKey: ['players'] });
  };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => profileApi.update(payload),
    onSuccess: (profile) => {
      qc.setQueryData(['profile'], profile); // show the result immediately
      invalidate();
    },
  });
}

export function useUploadProfilePicture() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (file: File) => profileApi.uploadPicture(file),
    onSuccess: invalidate,
  });
}

export function useRemoveProfilePicture() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: profileApi.removePicture,
    onSuccess: invalidate,
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profileApi.completeOnboarding,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      profileApi.changePassword(currentPassword, newPassword),
  });
}

export function useUploadTeamPhoto(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => profileApi.uploadTeamPhoto(teamId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useRemoveTeamPhoto(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => profileApi.removeTeamPhoto(teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}
