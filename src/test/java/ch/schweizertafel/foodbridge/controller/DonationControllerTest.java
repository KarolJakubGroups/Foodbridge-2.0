package ch.schweizertafel.foodbridge.controller;

import ch.schweizertafel.foodbridge.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DonationControllerTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository userRepository;

    @Test
    void availableEndpointHidesDonationsOlderThanFourDays() throws Exception {
        // seeded "Joghurt Nature" has createdAt = now - 5 days and must be filtered out (TF-03)
        mvc.perform(get("/api/donations/available"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].productName", not(hasItem("Joghurt Nature"))))
                .andExpect(jsonPath("$[*].productName", hasItem("Milch UHT 1l")))
                .andExpect(jsonPath("$[*].status", everyItem(is("AVAILABLE"))));
    }

    @Test
    void createDonationWithAllSevenFieldsSucceeds() throws Exception {
        Long donorId = userRepository.findByUsername("migros").orElseThrow().getId();
        LocalDateTime start = LocalDateTime.now().plusDays(1).withNano(0);
        String body = """
                {
                  "donorId": %d,
                  "productName": "Rüebli",
                  "temperatureRange": "CHILLED",
                  "bestBeforeDate": "%s",
                  "pickupAddress": "Limmatstrasse 152, 8005 Zürich",
                  "numberOfPallets": 2,
                  "weightPerPallet": 250.5,
                  "overlapStart": "%s",
                  "overlapEnd": "%s"
                }
                """.formatted(donorId, LocalDate.now().plusDays(5), start, start.plusHours(6));

        mvc.perform(post("/api/donations").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("AVAILABLE")))
                .andExpect(jsonPath("$.totalWeightKg", is(501.0)))
                .andExpect(jsonPath("$.donor.username", is("migros")));
    }

    @Test
    void createDonationWithMissingMandatoryFieldsIsRejected() throws Exception {
        Long donorId = userRepository.findByUsername("migros").orElseThrow().getId();
        // weightPerPallet and pickupAddress missing (TF-02)
        String body = """
                {
                  "donorId": %d,
                  "productName": "Rüebli",
                  "temperatureRange": "CHILLED",
                  "bestBeforeDate": "%s",
                  "numberOfPallets": 2,
                  "overlapStart": "%s",
                  "overlapEnd": "%s"
                }
                """.formatted(donorId, LocalDate.now().plusDays(5), LocalDateTime.now().plusDays(1).withNano(0),
                LocalDateTime.now().plusDays(1).plusHours(2).withNano(0));

        mvc.perform(post("/api/donations").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.weightPerPallet", notNullValue()))
                .andExpect(jsonPath("$.fields.pickupAddress", notNullValue()));
    }

    @Test
    void loginWithSeededAccountWorks() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"dispatcher_gt\",\"password\":\"password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("DISPATCHER")))
                .andExpect(jsonPath("$.password").doesNotExist());
    }
}
