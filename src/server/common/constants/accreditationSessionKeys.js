export const ACCREDITATION_SESSION_KEYS = {
  organisationId: 'accreditation.organisationId',
  accreditationId: 'accreditation.accreditationId',
  materialType: 'accreditation.materialType',
  registrationId: 'accreditation.registrationId',
  year: 'accreditation.year',
  declaration: 'accreditation.declaration',
  applicationReference: 'accreditation.applicationReference',
  accreditationReference: 'accreditation.accreditationReference',
  addOverseasSite: 'accreditation.addOverseasSite',
  addInterimSite: 'accreditation.addInterimSite',
  // RA-555: transient authoriser tick state for the tonnage-authority page,
  // held here so adding an authoriser doesn't discard it. Cleared once the
  // selection reaches the backend.
  tonnageAuthoritySelection: 'accreditation.tonnageAuthoritySelection'
}
