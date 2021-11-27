import styled, {css} from 'styled-components'

export const Hidden = styled.div`
  display: inherit;
  flex-direction: inherit;

  ${({maxWidth}) => maxWidth && css`
    @media (max-width: ${maxWidth}) {
      display: none;
    }
  `}

  ${({minWidth}) => minWidth && css`
    @media (min-width: ${minWidth}) {
      display: none;
    }
  `}
`